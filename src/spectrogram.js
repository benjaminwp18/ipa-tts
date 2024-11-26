export class Spectrogram {
    constructor(ctx, canvas) {
        this.ctx = ctx;
        this.canvas = canvas;

        this.analyzerNode = ctx.createAnalyser();
        this.analyzerNode.fftSize = 1024;
        this.analyzerNode.smoothingTimeConstant = 0;
        ctx.destination.connect(this.analyzerNode);
    }

    start() {
        let analyzerNode = this.analyzerNode;
        let fftArray = new Float32Array(analyzerNode.frequencyBinCount);

        let canvas = this.canvas;
        const canvasCtx = this.canvas.getContext("2d");

        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
        const spectrogramDuration = 5000;  // milliseconds
        const leftSidebarWidth = 50;
        const bottomPadding = 10;
        const chartHeight = canvas.height - bottomPadding;
    
        const pixelsPerMilli = (canvas.width - leftSidebarWidth) / spectrogramDuration;
        let spectrogramLastX = leftSidebarWidth;    
    
        // Don't display frequencies above 10 kHz
        const targetMaxFrequency = 10500;
        let displayedBinCount = Math.ceil(analyzerNode.frequencyBinCount / this.ctx.sampleRate * targetMaxFrequency);
    
        // Draw y labels
        let maxDisplayedFrequency = displayedBinCount / analyzerNode.frequencyBinCount * this.ctx.sampleRate;
        let axisSpacingHertz = 1000;
        let axisSpacingPixels = chartHeight / maxDisplayedFrequency * axisSpacingHertz;
    
        canvasCtx.lineWidth = 1.5;
        canvasCtx.textAlign = 'right';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillStyle ='black';
        let labelFreq = 0;
        for (let y = chartHeight; y > 0; y -= axisSpacingPixels) {
            if (y != chartHeight) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(leftSidebarWidth - 10, y);
                canvasCtx.lineTo(leftSidebarWidth, y);
                canvasCtx.stroke();
            }
    
            canvasCtx.fillText(labelFreq, leftSidebarWidth - 12, y);
            labelFreq += axisSpacingHertz;
        }
    
        canvasCtx.fillRect(leftSidebarWidth - 10, chartHeight, canvas.width - leftSidebarWidth + 10, 2);
        canvasCtx.fillRect(leftSidebarWidth - 2, 0, 2, chartHeight);
    
        let startTime = performance.now();
    
        function updateSpectrogram() {
            let spectrogramCurrentX = Math.floor((performance.now() - startTime) * pixelsPerMilli + leftSidebarWidth)
            if (spectrogramCurrentX <= spectrogramLastX) {
                requestAnimationFrame(updateSpectrogram);
                return;
            }
    
            analyzerNode.getFloatFrequencyData(fftArray);
            
            let binHeight = chartHeight / displayedBinCount;
            let lastBinY = chartHeight;
            for(let i = 0; i < displayedBinCount; i++) {
                let intensity = Math.max(Math.min(255 + fftArray[i] * 3, 255), 0);
                canvasCtx.fillStyle = `rgb(
                    ${255 - intensity}
                    255
                    ${255 - intensity})`;
                
                let binY = Math.floor(chartHeight - binHeight * (i + 1));
                canvasCtx.fillRect(spectrogramLastX, binY, spectrogramCurrentX - spectrogramLastX, lastBinY - binY);
                lastBinY = binY;
            }
    
            spectrogramLastX = spectrogramCurrentX;
            if (spectrogramCurrentX < canvas.width) {
                requestAnimationFrame(updateSpectrogram);
            }
        }
    
        updateSpectrogram();
    }


}