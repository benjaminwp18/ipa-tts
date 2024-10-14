async function test() {
    s = klattMake(new KlattParam1980());
    s.run();
    await s.play();
}

/***** HELPERS *****/

// https://github.com/chdh/klatt-syn-app/blob/master/src/InternalAudioPlayer.ts
const offlineAudioContext = new OfflineAudioContext(1, 1, 44100);

async function playSamples(samples, sampleRate) {
    const buffer = samplesToBuffer(samples, sampleRate);
    await playBuffer(buffer);
}

function samplesToBuffer(samples, sampleRate) {
    const buffer = offlineAudioContext.createBuffer(1, samples.length, sampleRate);
    // TODO: Use something more like this:
    // buffer.copyToChannel(samples, 0);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
        data[i] = samples[i];
    }
    return buffer;
}

async function playBuffer (buffer) {
    const audioContext = new AudioContext();
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(audioContext.destination);
    sourceNode.start();
}

// https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
// Standard Normal variate using Box-Muller transform.
function gaussianRandom(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function gaussianRandomArray(size=1, mean=0, stdev=1) {
    let array = [];
    for (let i = 0; i < size; i++) {
        array.push(gaussianRandom(mean, stdev));
    }
    return array;
}

const PARAM_NAMES = [
    "FS",
    "DUR",
    "N_FORM",
    "N_SAMP",
    "VER",
    "DT",
    "F0",
    "FF",
    "BW",
    "AV",
    "AVS",
    "AH",
    "AF",
    "FNZ",
    "SW",
    "FGP",
    "BGP",
    "FGZ",
    "BGZ",
    "FNP",
    "BNP",
    "BNZ",
    "BGS",
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "AN",
];

function klattMake(params = new KlattParam1980()) {
    // Initialize synth
    const synth = new KlattSynth();

    // Loop through all time-varying parameters, processing as needed
    // TODO: move this; it's just copying params from params into synth.params?
    PARAM_NAMES.forEach(paramName => {
        if (paramName === "FF" || paramName === "BW") {
            synth.params[paramName] = [];
            for (let i = 0; i < params.N_FORM; i++) {
                synth.params[paramName].push(params[paramName][i]);
            }
        }
        else {
            synth.params[paramName] = params[paramName];
        }
    });

    synth.setup();

    return synth;
}

/***** KLATT SYNTH & PARAMS *****/

class KlattParam1980 {
    // TODO: Named params doesn't work in JS. Use a dict?
    constructor(FS = 10000, N_FORM = 5, DUR = 1, F0 = 100,
        FF = [500, 1500, 2500, 3500, 4500],
        BW = [50, 100, 100, 200, 250],
        AV = 60, AVS = 0, AH = 0, AF = 0,
        SW = 0, FGP = 0, BGP = 100, FGZ = 1500, BGZ = 6000,
        FNP = 250, BNP = 100, FNZ = 250, BNZ = 100, BGS = 200,
        A1 = 0, A2 = 0, A3 = 0, A4 = 0, A5 = 0, A6 = 0, AN = 0) {

        this.FS = FS;
        this.DUR = DUR;
        this.N_FORM = N_FORM;
        this.N_SAMP = Math.round(FS * DUR);
        this.VER = "KLSYN80";
        this.DT = 1 / FS;
        this.F0 = new Array(this.N_SAMP).fill(F0);
        this.FF = FF.map(f => new Array(this.N_SAMP).fill(f));
        this.BW = BW.map(b => new Array(this.N_SAMP).fill(b));
        this.AV = new Array(this.N_SAMP).fill(AV);
        this.AVS = new Array(this.N_SAMP).fill(AVS);
        this.AH = new Array(this.N_SAMP).fill(AH);
        this.AF = new Array(this.N_SAMP).fill(AF);
        this.FNZ = new Array(this.N_SAMP).fill(FNZ);
        this.SW = new Array(this.N_SAMP).fill(SW);
        this.FGP = new Array(this.N_SAMP).fill(FGP);
        this.BGP = new Array(this.N_SAMP).fill(BGP);
        this.FGZ = new Array(this.N_SAMP).fill(FGZ);
        this.BGZ = new Array(this.N_SAMP).fill(BGZ);
        this.FNP = new Array(this.N_SAMP).fill(FNP);
        this.BNP = new Array(this.N_SAMP).fill(BNP);
        this.BNZ = new Array(this.N_SAMP).fill(BNZ);
        this.BGS = new Array(this.N_SAMP).fill(BGS);
        this.A1 = new Array(this.N_SAMP).fill(A1);
        this.A2 = new Array(this.N_SAMP).fill(A2);
        this.A3 = new Array(this.N_SAMP).fill(A3);
        this.A4 = new Array(this.N_SAMP).fill(A4);
        this.A5 = new Array(this.N_SAMP).fill(A5);
        this.A6 = new Array(this.N_SAMP).fill(A6);
        this.AN = new Array(this.N_SAMP).fill(AN);
    }
}

class KlattSynth {
    constructor() {
        // Create name
        this.name = "Klatt Formant Synthesizer";

        // Create empty attributes
        this.output = null;
        this.sections = null;

        // Create synthesis parameters array
        const paramList = [
            "F0", "AV", "OQ", "SQ", "TL", "FL", // Source
            "DI", "AVS", "AV", "AF", "AH",      // Source
            "FF", "BW",                         // Formants
            "FGP", "BGP", "FGZ", "BGZ", "BGS",  // Glottal pole/zero
            "FNP", "BNP", "FNZ", "BNZ",         // Nasal pole/zero
            "FTP", "BTP", "FTZ", "BTZ",         // Tracheal pole/zero
            "A2F", "A3F", "A4F", "A5F", "A6F",  // Frication parallel
            "B2F", "B3F", "B4F", "B5F", "B6F",  // Frication parallel
            "A1V", "A2V", "A3V", "A4V", "ATV",  // Voicing parallel
            "A1", "A2", "A3", "A4", "A5", "AN", // 1980 parallel
            "ANV",                              // Voicing parallel
            "SW", "INV_SAMP",                   // Synth settings
            "N_SAMP", "FS", "DT", "VER"         // Synth settings
        ];

        // Initialize params with null values
        this.params = {};
        for (const param of paramList) {
            this.params[param] = null;
        }
    }

    setup() {
        // Initialize data vectors
        this.output = new Array(this.params["N_SAMP"]).fill(0);

        // Differential functiontioning based on version...
        if (this.params["VER"] === "KLSYN80") {
            // Initialize sections
            this.voice = new KlattVoice1980(this);
            this.noise = new KlattNoise1980(this);
            this.cascade = new KlattCascade1980(this);
            this.parallel = new KlattParallel1980(this);
            this.radiation = new KlattRadiation1980(this);
            this.outputModule = new OutputModule(this);

            // Create section-level connections
            this.voice.connect([this.cascade, this.parallel]);
            this.noise.connect([this.cascade, this.parallel]);
            this.cascade.connect([this.radiation]);
            this.parallel.connect([this.radiation]);
            this.radiation.connect([this.outputModule]);

            // Put all section objects into this.sections for reference
            this.sections = [this.voice, this.noise, this.cascade,
                             this.parallel, this.radiation, this.outputModule];

            // Patch all components together within sections
            for (const section of this.sections) {
                section.patch();
            }
        }
        else {
            console.log("Sorry, versions other than Klatt 1980 are not supported.");
        }
    }

    run() {
        this.output = new Array(this.params["N_SAMP"]).fill(0);

        // Clear inputs and outputs in each component
        for (const section of this.sections) {
            for (const component of section.components) {
                component.clean();
            }
        }

        // Run each section
        for (const section of this.sections) {
            section.run();
            
        }

        this.output = [...this.outputModule.output];
    }

    async play() {
        console.log(this.output);

        await playSamples(this.output, 10000);
    }
}

/***** BASE CLASSES *****/

class KlattComponent {
    constructor(mast, dests = []) {
        this.mast = mast;
        this.dests = dests;
        this.input = new Array(this.mast.params["N_SAMP"]).fill(0);
        this.output = new Array(this.mast.params["N_SAMP"]).fill(0);
    }

    receive(signal) {
        for (let i = 0; i < signal.length; i++) {
            this.input[i] = signal[i];
        }
    }

    send() {
        console.log(`\t${this.constructor.name} sends`, [...this.output]);
        for (const dest of this.dests) {
            dest.receive([...this.output]);
        }
    }

    connect(components) {
        for (const component of components) {
            this.dests.push(component);
        }
    }

    clean() {
        this.input.fill(0);
        this.output.fill(0);
    }
}

class KlattSection {
    constructor(mast) {
        this.mast = mast;
        this.components = [];
        this.ins = [];
        this.outs = [];
    }

    connect(sections) {
        for (const section of sections) {
            section.ins.push(new Buffer(this.mast));
            this.outs.push(new Buffer(this.mast, [section.ins[section.ins.length - 1]]));
        }
    }

    processIns() {
        for (const inEl of this.ins) {
            inEl.process();
        }
    }

    processOuts() {
        for (const out of this.outs) {
            out.process();
        }
    }

    run() {
        if (this.ins !== null && this.ins.length > 0) {
            this.processIns();
        }
        this.do();
        if (this.ins !== null && this.outs.length > 0) {
            this.processOuts();
        }
    }
}

/***** SECTIONS *****/

class KlattVoice1980 extends KlattSection {
    constructor(mast) {
        super(mast);
        this.impulse = new Impulse(this.mast);
        this.rgp = new Resonator(this.mast);
        this.rgz = new Resonator(this.mast, true);
        this.rgs = new Resonator(this.mast);
        this.av = new Amplifier(this.mast);
        this.avs = new Amplifier(this.mast);
        this.mixer = new Mixer(this.mast);
        this.switch = new Switch(this.mast);
        this.components = [this.impulse, this.rgp, this.rgz, this.rgs,
                           this.av, this.avs, this.mixer, this.switch];
    }

    patch() {
        this.impulse.connect([this.rgp]);
        this.rgp.connect([this.rgz, this.rgs]);
        this.rgz.connect([this.av]);
        this.rgs.connect([this.avs]);
        this.av.connect([this.mixer]);
        this.avs.connect([this.mixer]);
        this.mixer.connect([this.switch]);
        this.switch.connect([...this.outs]);
    }

    do() {
        this.impulse.impulseGen(this.mast.params["F0"]);
        this.rgp.resonate(this.mast.params["FGP"], this.mast.params["BGP"]);
        this.rgz.resonate(this.mast.params["FGZ"], this.mast.params["BGZ"]);
        this.rgs.resonate(this.mast.params["FGP"], this.mast.params["BGS"]);
        this.av.amplify(this.mast.params["AV"]);
        this.avs.amplify(this.mast.params["AVS"]);
        this.mixer.mix();
        this.switch.operate(this.mast.params["SW"]);

        console.log("KlattVoice outputs", [...this.switch.output])
    }
}
  
class KlattNoise1980 extends KlattSection {
    constructor(mast) {
        super(mast);
        this.noisegen = new Noisegen(this.mast);
        this.lowpass = new Lowpass(this.mast);
        this.amp = new Amplifier(this.mast);
        this.components = [this.noisegen, this.lowpass, this.amp];
    }

    patch() {
        this.noisegen.connect([this.lowpass]);
        this.lowpass.connect([this.amp]);
        this.amp.connect([...this.outs]);
    }

    do() {
        this.noisegen.generate();
        this.lowpass.filter();
        this.amp.amplify(-60);  // TODO: -60 might not be real value

        console.log("KlattNoise outputs", [...this.amp.output])
    }
}

class KlattCascade1980 extends KlattSection {
    constructor(mast) {
        super(mast);
        this.ah = new Amplifier(mast);
        this.mixer = new Mixer(mast);
        this.rnp = new Resonator(mast);
        this.rnz = new Resonator(mast, true);
        this.formants = [];
        for (let form = 0; form < this.mast.params["N_FORM"]; form++) {
            this.formants.push(new Resonator(mast));
        }
        this.components = [this.ah, this.mixer, this.rnp, this.rnz, ...this.formants];
    }

    patch() {
        this.ins[0].connect([this.mixer]);
        this.ins[1].connect([this.ah]);
        this.ah.connect([this.mixer]);
        this.mixer.connect([this.rnp]);
        this.rnp.connect([this.rnz]);
        this.rnz.connect([this.formants[0]]);
        for (let i = 0; i < this.mast.params["N_FORM"] - 1; i++) {
            this.formants[i].connect([this.formants[i + 1]]);
        }
        this.formants[this.mast.params["N_FORM"] - 1].connect([...this.outs]);
    }

    do() {
        this.ah.amplify(this.mast.params["AH"]);
        this.mixer.mix();
        this.rnp.resonate(this.mast.params["FNP"], this.mast.params["BNP"]);
        this.rnz.resonate(this.mast.params["FNZ"], this.mast.params["BNZ"]);
        for (let form = 0; form < this.formants.length; form++) {
            this.formants[form].resonate(this.mast.params["FF"][form], this.mast.params["BW"][form]);
        }

        console.log("KlattCascade outputs", [...this.formants[this.mast.params["N_FORM"] - 1].output])
    }
}

class KlattParallel1980 extends KlattSection {
    constructor(mast) {
        super(mast);

        this.af = new Amplifier(mast);
        this.a1 = new Amplifier(mast);
        this.r1 = new Resonator(mast);
        this.firstDiff = new Firstdiff(mast);
        this.mixer = new Mixer(mast);
        this.an = new Amplifier(mast);
        this.rnp = new Resonator(mast);
        this.a2 = new Amplifier(mast);
        this.r2 = new Resonator(mast);
        this.a3 = new Amplifier(mast);
        this.r3 = new Resonator(mast);
        this.a4 = new Amplifier(mast);
        this.r4 = new Resonator(mast);
        this.a5 = new Amplifier(mast);
        this.r5 = new Resonator(mast);
        // TODO: 6th formant currently not part of this.do()! Not sure what values
        // to give to it... need to keep reading Klatt 1980.
        this.a6 = new Amplifier(mast);
        this.r6 = new Resonator(mast);
        // TODO: ab currently not part of this.do()! Not sure what values to give
        // to it... need to keep reading Klatt 1980.
        this.ab = new Amplifier(mast);
        this.outputMixer = new Mixer(mast);

        this.components = [
            this.af, this.a1, this.r1, this.firstDiff, this.mixer, this.an, 
            this.rnp, this.a2, this.r2, this.r1, this.firstDiff, this.mixer, 
            this.an, this.rnp, this.a2, this.r2, this.a3, this.r3, this.a4, 
            this.r4, this.a5, this.r5, this.a6, this.r6, this.ab, this.outputMixer
        ];
    }

    patch() {
        this.ins[1].connect([this.af]);
        this.ins[0].connect([this.a1, this.firstDiff]);
        this.af.connect([this.mixer, this.a5, this.a6, this.ab]);
        this.firstDiff.connect([this.mixer]);
        this.mixer.connect([this.an, this.a2, this.a3, this.a4]);
        this.a1.connect([this.r1]);
        this.an.connect([this.rnp]);
        this.a2.connect([this.r2]);
        this.a3.connect([this.r3]);
        this.a4.connect([this.r4]);
        this.a5.connect([this.r5]);
        this.r6.connect([this.r6]);
        const finalComponents = [this.r1, this.r2, this.r3, this.r4, this.r5, this.r6, this.rnp, this.ab];
        for (const component of finalComponents) {
            component.connect([this.outputMixer]);
        }
        this.outputMixer.connect([...this.outs]);
    }

    do() {
        this.af.amplify(this.mast.params["AF"]);
        this.a1.amplify(this.mast.params["A1"]);
        this.r1.resonate(this.mast.params["FF"][0], this.mast.params["BW"][0]);
        this.firstDiff.differentiate();
        this.mixer.mix();
        this.an.amplify(this.mast.params["AN"]);
        this.rnp.resonate(this.mast.params["FNP"], this.mast.params["BNP"]);
        this.a2.amplify(this.mast.params["A2"]);
        this.r2.resonate(this.mast.params["FF"][1], this.mast.params["BW"][1]);
        this.a3.amplify(this.mast.params["A3"]);
        this.r3.resonate(this.mast.params["FF"][2], this.mast.params["BW"][2]);
        this.a4.amplify(this.mast.params["A4"]);
        this.r4.resonate(this.mast.params["FF"][3], this.mast.params["BW"][3]);
        this.a5.amplify(this.mast.params["A5"]);
        this.r5.resonate(this.mast.params["FF"][4], this.mast.params["BW"][4]);
        this.outputMixer.mix();

        console.log("KlattParallel outputs", [...this.outputMixer.output])
    }
}

class KlattRadiation1980 extends KlattSection {
    constructor(mast) {
        super(mast);
        this.mixer = new Mixer(mast);
        this.firstdiff = new Firstdiff(mast);
        this.components = [this.mixer, this.firstdiff];
    }

    patch() {
        for (const inEl of this.ins) {
            inEl.connect([this.mixer]);
        }
        this.mixer.connect([this.firstdiff]);
        this.firstdiff.connect([...this.outs]);
    }

    do() {
        this.mixer.mix();
        this.firstdiff.differentiate();

        console.log("KlattRadiation outputs", [...this.firstdiff.output])
    }
}

class OutputModule extends KlattSection {
    constructor(mast) {
        super(mast);
        this.mixer = new Mixer(mast);
        this.normalizer = new Normalizer(mast);
        this.output = new Array(this.mast.params["N_SAMP"]).fill(0);
        this.components = [this.mixer, this.normalizer];
    }

    patch() {
        for (const inEl of this.ins) {
            inEl.dests = [this.mixer];
        }
        this.mixer.dests = [this.normalizer];
        this.normalizer.dests = [...this.outs];
    }

    do() {
        this.mixer.mix();
        this.normalizer.normalize();
        this.output = [...this.normalizer.output];

        console.log("OutputModule outputs", [...this.output])
    }
}


/***** COMPONENTS *****/

class Buffer extends KlattComponent {
    constructor(mast, dests = []) {
        super(mast, dests);
    }

    process() {
        this.output = [...this.input];
        this.send();
    }
}

class Resonator extends KlattComponent {
    constructor(mast, anti = false) {
        super(mast);
        this.anti = anti;
    }

    calcCoef(ff, bw) {
        const piDT = Math.PI * this.mast.params["DT"];

        let c = [];
        let b = [];
        let a = [];
        for (let i = 0; i < bw.length; i++) {
            c.push(-Math.exp(-2 * piDT * bw[i]));
            b.push(2 * Math.exp(-piDT * bw[i]) * Math.cos(2 * piDT * ff[i]));
            a.push(1 - b[i] - c[i]);
        }

        if (this.anti) {
            let aPrime = [];
            let bPrime = [];
            let cPrime = [];

            for (let i = 0; i < a.length; i++) {
                aPrime.push(1 / a[i]);
                bPrime.push(-b[i] / a[i]);
                cPrime.push(-c[i] / a[i]);
            }

            console.log("PRIMES: ", aPrime, bPrime, cPrime);

            return [aPrime, bPrime, cPrime];
        }
        else {
            return [a, b, c];
        }
    }

    resonate(ff, bw) {
        const [a, b, c] = this.calcCoef(ff, bw);
        this.output[0] = a[0] * this.input[0];

        // TODO: simplify cases
        if (this.anti) {
            this.output[1] = a[1] * this.input[1] + b[1] * this.input[0];
            for (let i = 2; i < this.mast.params["N_SAMP"]; i++) {
                this.output[i] = a[i] * this.input[i] +
                                 b[i] * this.input[i - 1] +
                                 c[i] * this.input[i - 2];
            }
        }
        else {
            this.output[1] = a[1] * this.input[1] + b[1] * this.output[0];
            for (let i = 2; i < this.mast.params["N_SAMP"]; i++) {
                this.output[i] = a[i] * this.input[i] +
                                 b[i] * this.output[i - 1] +
                                 c[i] * this.output[i - 2];
            }
        }

        this.send();
    }
}

class Impulse extends KlattComponent {
    constructor(mast) {
        super(mast);
        this.lastGlotPulse = 0;
    }

    impulseGen(F0) {
        let glotPeriod = [];
        for (const F0El of F0) {
            glotPeriod.push(Math.round(this.mast.params["FS"] / F0El));
        }

        this.lastGlotPulse = 0;
        for (let i = 0; i < this.mast.params["N_SAMP"]; i++) {
            if (i - this.lastGlotPulse >= glotPeriod[i]) {
                this.output[i] = 1;
                this.lastGlotPulse = i;
            }
        }

        this.send();
    }
}

class Mixer extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    receive(signal) {
        this.input = [...this.input];
        for (let i = 0; i < this.input.length; i++) {
            this.input[i] += signal[i];
        }
    }

    mix() {
        this.output = [...this.input];
        this.send();
    }
}

class Amplifier extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    amplify(dB) {
        dB = Math.sqrt(10) ^ (dB / 10)
        this.output = this.input.map(inEl => inEl * dB);
        this.send();
    }
}

class Firstdiff extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    differentiate() {
        this.output[0] = 0;
        for (let i = 1; i < this.mast.params["N_SAMP"]; i++) {
            this.output[i] = this.input[i] - this.input[i - 1];
        }
        this.send();
    }
}

class Lowpass extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    filter() {
        this.output[0] = this.input[0];
        for (let i = 1; i < this.mast.params["N_SAMP"]; i++) {
            this.output[i] = this.input[i] + this.output[i - 1];
        }
        this.send();
    }
}

class Normalizer extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    normalize() {
        const absMax = Math.max(...this.input.map(Math.abs));
        this.output = this.input.map(inputEl => inputEl / absMax);
        this.send();
    }
}

class Noisegen extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    generate() {
        this.output = gaussianRandomArray(this.mast.params["N_SAMP"]);
        this.send();
    }
}

class Switch extends KlattComponent {
    constructor(mast) {
        super(mast);
        this.clean();
    }

    send() {
        this.dests[0].receive([...this.output[0]]);
        this.dests[1].receive([...this.output[1]]);
    }

    operate(choice) {
        for (let i = 0; i < this.mast.params["N_SAMP"]; i++) {
            if (choice[i] === 0) {
                this.output[0][i] = this.input[i];
                this.output[1][i] = 0;
            }
            else if (choice[i] === 1) {
                this.output[0][i] = 0;
                this.output[1][i] = this.input[i];
            }
        }
        this.send();
    }

    clean() {
        this.output = [];
        this.output.push(new Array(this.mast.params["N_SAMP"]).fill(0));
        this.output.push(new Array(this.mast.params["N_SAMP"]).fill(0));
    }
}
