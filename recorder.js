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

    // Create a destination for the processed audio
    const destination = this.audioContext.createMediaStreamDestination();
    
    // Connect the audio processing chain
    source.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(destination);

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