import * as Klatt from "./klatt.js";

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
const DURATION = 1;

class Vowel {
    constructor(formants) {
        this.formants = formants;
    }

    play(ctx, start = 0, duration = 1) {
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
            filter.connect(ctx.destination);
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
    Klatt.playWord(word);
}
