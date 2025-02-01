class VoiceRecorder {
  constructor() {
    this.audioContext = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.visualizer = document.getElementById('visualizer');
    this.visualizerCtx = this.visualizer.getContext('2d');
    this.recordBtn = document.getElementById('recordBtn');
    this.audioPlayback = document.getElementById('audioPlayback');
    this.headVoiceLevel = document.getElementById('headVoiceLevel');
    
    this.setupEventListeners();
    this.setupCanvas();
  }

  setupCanvas() {
    this.visualizer.width = this.visualizer.offsetWidth;
    this.visualizer.height = this.visualizer.offsetHeight;
  }

  setupEventListeners() {
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    window.addEventListener('resize', () => this.setupCanvas());
  }

  async initializeAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.setupAudioProcessing(stream);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Unable to access microphone. Please ensure you have given permission.');
      }
    }
  }

  setupAudioProcessing(stream) {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 2048;
    
    source.connect(analyzer);
    
    // Create audio processing nodes
    const lowShelf = this.audioContext.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 300;
    lowShelf.gain.value = 10;

    const highShelf = this.audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2000;
    highShelf.gain.value = -10;

    // Create media recorder with processed audio
    const processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    processorNode.onaudioprocess = (e) => {
      if (this.isRecording) {
        const intensity = this.headVoiceLevel.value / 100;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const outputBuffer = e.outputBuffer.getChannelData(0);
        
        // Apply head voice effect
        for (let i = 0; i < inputBuffer.length; i++) {
          outputBuffer[i] = this.processAudioSample(inputBuffer[i], intensity);
        }
      }
    };

    source.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(processorNode);
    processorNode.connect(this.audioContext.destination);

    // Setup recording
    const processedStream = processorNode.stream;
    this.mediaRecorder = new MediaRecorder(processedStream);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.audioPlayback.src = URL.createObjectURL(blob);
      this.chunks = [];
    };

    // Visualizer
    const drawVisualizer = () => {
      requestAnimationFrame(drawVisualizer);
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteTimeDomainData(dataArray);
      
      this.visualizerCtx.fillStyle = '#f8f9fa';
      this.visualizerCtx.fillRect(0, 0, this.visualizer.width, this.visualizer.height);
      
      this.visualizerCtx.lineWidth = 2;
      this.visualizerCtx.strokeStyle = '#1a73e8';
      this.visualizerCtx.beginPath();
      
      const sliceWidth = this.visualizer.width / dataArray.length;
      let x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * this.visualizer.height / 2;
        
        if (i === 0) {
          this.visualizerCtx.moveTo(x, y);
        } else {
          this.visualizerCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      this.visualizerCtx.lineTo(this.visualizer.width, this.visualizer.height / 2);
      this.visualizerCtx.stroke();
    };
    
    drawVisualizer();
  }

  processAudioSample(sample, intensity) {
    // Simulate head voice by enhancing certain frequencies and adding resonance
    const resonance = 0.3 * intensity;
    const bassBoost = 0.4 * intensity;
    
    // Add subtle harmonic enhancement
    const harmonic = Math.sin(sample * Math.PI * 2) * 0.2 * intensity;
    
    // Combine original signal with processed components
    return sample * (1 - intensity) + 
           (sample + harmonic) * resonance +
           Math.tanh(sample * 3) * bassBoost;
  }

  async toggleRecording() {
    if (!this.isRecording) {
      await this.initializeAudio();
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordBtn.textContent = 'Stop Recording';
      this.recordBtn.classList.add('recording');
    } else {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.recordBtn.textContent = 'Start Recording';
      this.recordBtn.classList.remove('recording');
    }
  }
}

// Initialize the recorder when the page loads
window.addEventListener('load', () => {
  new VoiceRecorder();
});