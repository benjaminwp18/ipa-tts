class Formant {
    /**
     * Formant bandpass filter configuration
     * freq: center frequency (Hz)
     * amp: amplitude (dB)
     * bw: bandwidth (Hz)
     * TODO: are these actually the units that BiquadFilters use?
     */
    constructor(freq, amp, bw) {
        this.freq = freq;
        this.amp = amp;
        this.bw = bw;
    }
}

const FUNDAMENTAL = 80;  // Hz
const DURATION = 0.5;

class Vowel {
    constructor(formants) {
        this.formants = formants;
    }

    play(ctx, destination, start = 0, duration = 1) {
        let osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = FUNDAMENTAL;

        for (const formant of this.formants) {
            let filter = ctx.createBiquadFilter();

            filter.type = 'bandpass';
            filter.frequency.value = formant.freq;
            filter.gain.value = formant.amp;
            filter.Q.value = formant.bw;

            osc.connect(filter);
            filter.connect(destination);
        }

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
    }
}

const VOWELS = {
    a: new Vowel([
        new Formant(600, 0, 60),
        new Formant(1040, -7, 70),
        new Formant(2250, -9, 110),
        new Formant(2450, -9, 120),
        new Formant(2750, -20, 130)
    ]),
    e: new Vowel([
        new Formant(400, 0, 40),
        new Formant(1620, -12, 80),
        new Formant(2400, -9, 100),
        new Formant(2800, -12, 120),
        new Formant(3100, -18, 120)
    ]),
    i: new Vowel([
        new Formant(250, 0, 60),
        new Formant(1750, -30, 90),
        new Formant(2600, -16, 100),
        new Formant(3050, -22, 120),
        new Formant(3340, -28, 120)
    ]),
    o: new Vowel([
        new Formant(400, 0, 40),
        new Formant(750, -11, 80),
        new Formant(2400, -21, 100),
        new Formant(2600, -20, 120),
        new Formant(2900, -40, 120)
    ]),
    u: new Vowel([
        new Formant(350, 0, 40),
        new Formant(600, -20, 80),
        new Formant(2400, -32, 100),
        new Formant(2675, -28, 120),
        new Formant(2950, -36, 120)
    ])
};


export function playWord(ctx, word) {
    let analyzerNode = ctx.createAnalyser();
    analyzerNode.fftSize = 1024;
    analyzerNode.smoothingTimeConstant = 0;
    analyzerNode.connect(ctx.destination);

    let fftArray = new Float32Array(analyzerNode.frequencyBinCount);

    let t = 0;
    for (let i = 0; i < word.length; i++) {
        let phone = word[i];
        let vowel = VOWELS[phone]
        if (vowel !== undefined) {
            vowel.play(ctx, analyzerNode, t, DURATION);
            t += DURATION;
        }
    }

    const canvas = document.getElementById('spectrogram');
    const canvasCtx = canvas.getContext("2d");

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
    let displayedBinCount = Math.ceil(analyzerNode.frequencyBinCount / ctx.sampleRate * targetMaxFrequency);

    // Draw y labels
    let maxDisplayedFrequency = displayedBinCount / analyzerNode.frequencyBinCount * ctx.sampleRate;
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