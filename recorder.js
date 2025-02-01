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
    this.headVoiceLevel.addEventListener('input', () => this.updateHeadVoiceProcessing());
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

  updateHeadVoiceProcessing() {
    if (!this.filters) return;
    
    // Increased range and more dramatic effects
    const intensity = (this.headVoiceLevel.value / 100) * 2; // Now goes up to 2x intensity
    
    // Enhanced resonance peaks with wider ranges
    this.filters.lowResonance.frequency.value = 250 + (intensity * 400);  // 250-650 Hz range
    this.filters.lowResonance.Q.value = 2 + (intensity * 6);  // Much sharper resonance
    this.filters.lowResonance.gain.value = 15 * intensity;  // Stronger low boost

    this.filters.midResonance.frequency.value = 800 + (intensity * 1000);  // 800-1800 Hz
    this.filters.midResonance.Q.value = 1.5 + (intensity * 4);
    this.filters.midResonance.gain.value = 8 * intensity;

    // More aggressive high frequency attenuation
    this.filters.highShelf.frequency.value = 2000;
    this.filters.highShelf.gain.value = -18 * intensity;

    // Enhanced warmth in the low-mids
    this.filters.lowMidBoost.frequency.value = 500 + (intensity * 200);
    this.filters.lowMidBoost.Q.value = 0.7 + (intensity * 0.6);
    this.filters.lowMidBoost.gain.value = 6 * intensity;
  }

  setupAudioProcessing(stream) {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 2048;
    
    // Create multiple filters for more accurate head voice simulation
    this.filters = {
      lowResonance: this.audioContext.createBiquadFilter(),
      midResonance: this.audioContext.createBiquadFilter(),
      highShelf: this.audioContext.createBiquadFilter(),
      lowMidBoost: this.audioContext.createBiquadFilter(),
    };

    // Configure filter types
    this.filters.lowResonance.type = 'peaking';
    this.filters.midResonance.type = 'peaking';
    this.filters.highShelf.type = 'highshelf';
    this.filters.lowMidBoost.type = 'peaking';

    // Create compressor for better dynamics control
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;

    // Create destination for the processed audio
    const destination = this.audioContext.createMediaStreamDestination();
    
    // Connect the audio processing chain
    source.connect(analyzer);
    source.connect(this.filters.lowResonance);
    this.filters.lowResonance.connect(this.filters.midResonance);
    this.filters.midResonance.connect(this.filters.highShelf);
    this.filters.highShelf.connect(this.filters.lowMidBoost);
    this.filters.lowMidBoost.connect(compressor);
    compressor.connect(destination);

    // Initialize filter values
    this.updateHeadVoiceProcessing();

    // Setup recording with the processed stream
    this.mediaRecorder = new MediaRecorder(destination.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      this.audioPlayback.src = url;
      this.chunks = [];
    };

    // Visualizer setup
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

  async toggleRecording() {
    try {
      if (!this.isRecording) {
        await this.initializeAudio();
        if (this.mediaRecorder) {
          this.mediaRecorder.start();
          this.isRecording = true;
          this.recordBtn.textContent = 'Stop Recording';
          this.recordBtn.classList.add('recording');
        }
      } else {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          this.isRecording = false;
          this.recordBtn.textContent = 'Start Recording';
          this.recordBtn.classList.remove('recording');
        }
      }
    } catch (error) {
      console.error('Error in toggleRecording:', error);
      alert('An error occurred while trying to record. Please make sure you have given microphone permissions.');
    }
  }
}

// Initialize the recorder when the page loads
window.addEventListener('load', () => {
  new VoiceRecorder();
});