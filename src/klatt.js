let ctx = null;
let audio_dst;

/**
 * Must be called before trying to use any other functions in this module.
 * saves the given audio context to use for all audio operations.
 * @param {AudioContext} context
 * @param {AudioNode} dst_node
 */
export function init(context, dst_node = null) {
    ctx = context;
    if(dst_node === null) {
        audio_dst = ctx.destination;
    } else {
        audio_dst = dst_node;
        audio_dst.connect(ctx.destination);
    }
}

class Nasal {
    constructor(formantFreqs, bandwidths, antiformants, duration_ms = 150) {
        if (formantFreqs.length !== bandwidths.length) {
            throw new Error(
                `Number of formant frequencies (${formantFreqs.length}) and bandwidths (${bandwidths.length}) must match.`
            );
        }

        this.formantFreqs = formantFreqs;
        this.bandwidths = bandwidths;
        this.antiformants = antiformants;
        this.duration_ms = duration_ms;
        this.AV = 60;
        this.AN = 40;
        this.AF = 0;
    }

    setAV(AV) {
        this.AV = AV;
        return this;
    }

    setAN(AN) {
        this.AN = AN;
        return this;
    }

    setDuration(duration_ms) {
        this.duration_ms = duration_ms;
        return this;
    }

    makeParams() {
        let params = new KlattParam();
        params.setMetadata(true, this.duration_ms / 1000);

        const N = params.N_SAMP;
        let FF = params.FF;
        let BW = params.BW;
        let AF = params.AN;

        if (FF.length < this.formantFreqs.length || BW.length < this.bandwidths.length) {
            throw new Error(
                `Insufficient formant slots in KlattParam (supports ${FF.length} formants).`
            );
        }

        if (AF.length < this.antiformants.length) {
            throw new Error(
                `Insufficient antiformant slots in KlattParam (supports ${AF.length} antiformants).`
            );
        }

        params.F0 = linearSequence(120, 70, N);

        for (let i = 0; i < this.formantFreqs.length; i++) {
            FF[i] = Array(N).fill(this.formantFreqs[i]);
            BW[i] = Array(N).fill(this.bandwidths[i]);
        }

        for (let i = 0; i < this.antiformants.length; i++) {
            AF[i] = Array(N).fill(this.antiformants[i]);
        }

        params.AV = Array(N).fill(this.AV);
        params.AN = Array(N).fill(this.AN);

        return params;
    }
}

class Fricative {
    constructor(duration_ms = 150) {
        this.duration_ms = duration_ms;
        this.AF = 0;
        this.AH = 0;
        this.AV = 60;
        this.A1 = 0;
        this.A2 = 0;
        this.A3 = 0;
        this.A4 = 0;
        this.A5 = 0;
        this.A6 = 0;
        this.AB = 0;
    }

    setAF(AF) {
        this.AF = AF;
        return this;
    }

    setAH(AH) {
        this.AH = AH;
        return this;
    }

    setAV(AV) {
        this.AV = AV;
        return this;
    }

    setAB(AB) {
        this.AB = AB;
        return this;
    }

    setAmps(resonatorNumbers, amplitudes) {
        if (resonatorNumbers.length !== amplitudes.length) {
            throw new Error("Must specify equal number of resonator numbers & amplitudes");
        }
        else {
            for (let i = 0; i < resonatorNumbers.length; i++) {
                this.setAmp(resonatorNumbers[i], amplitudes[i]);
            }
        }

        return this;
    }

    setAmp(resonatorNumber, amplitude) {
        switch (resonatorNumber) {
            case 1:
                this.A1 = amplitude;
                break;
            case 2:
                this.A2 = amplitude;
                break;
            case 3:
                this.A3 = amplitude;
                break;
            case 4:
                this.A4 = amplitude;
                break;
            case 5:
                this.A5 = amplitude;
                break;
            case 6:
                this.A6 = amplitude;
                break;
            default:
                throw new Error("Fricative resonator numbers must be integers 1-6");
        }

        return this;
    }

    makeParams() {
        let params = new KlattParam();

        params.setMetadata(true, this.duration_ms / 1000);

        const N = params.N_SAMP;

        params.F0 = linearSequence(120, 70, N);
        params.SW.fill(0);  // TODO: document what value is what side of the switch

        params.A1.fill(this.A1);
        params.A2.fill(this.A2);
        params.A3.fill(this.A3);
        params.A4.fill(this.A4);
        params.A5.fill(this.A5);
        params.A6.fill(this.A6);

        params.AB.fill(this.AB);
        params.AV.fill(this.AV);
        params.AF.fill(this.AF);  // TODO: AF seems to dominate noise from AV (for voiced C)
        params.AH.fill(this.AH);

        // TODO: fricatives are much louder than Vs so normalization is smushing V amplitude
        // Similarly, sh >>> s, so s gets smushed when paired with sh

        return params;
    }
}

class Monophthong {
    constructor(formantFreqs, bandwidths) {
        if (formantFreqs.length !== bandwidths.length) {
            throw new Error("Number of frequencies and number of bandwidths must be the same" +
                `(${formantFreqs.length} !== ${bandwidths.length})`)
        }

        this.formantFreqs = formantFreqs;
        this.bandwidths = bandwidths;
    }

    makeParams() {
        let params = new KlattParam();
        const N = params.N_SAMP;
        let FF = params.FF;
        let BW = params.BW;

        if (FF.length < this.formantFreqs.length) {
            throw new Error(`Cannot have more than ${FF.length} formants`);
        }

        params.AV.fill(60);
        params.F0 = linearSequence(120, 70, N);

        for (let i = 0; i < this.formantFreqs.length; i++) {
            FF[i].fill(this.formantFreqs[i]);
            BW[i].fill(this.bandwidths[i]);
        }

        return params;
    }
}

/***** HELPERS *****/

/**
 * Asynchronously play the provided samples as audio at the given sample rate.
 * @param {Array} samples float array of samples
 * @param {number} sampleRate integer sample rate, should be 10000 for Klatt
 */
async function playSamples(ctx, samples, sampleRate) {
    // Convert samples to audio context buffer
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    // TODO: Use something more like this:
    // buffer.copyToChannel(samples, 0);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
        data[i] = samples[i];
    }

    // Play the buffer
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(audio_dst);
    sourceNode.start();
}

/**
 * [TODO: remove this if it's not needed]
 * Get the outer product of column vectors a & b,
 * where b is transposed to act as a row vector. i.e. ab^T
 * @param {number[]} a array of numbers that will act as the column vector
 * @param {number[]} b array of numbers that will act as the row vector
 * @returns {number[][]} a 2D array with a.length rows & b.length cols,
 *                       where output[r][c] = a[r] * b[c]
 */
function outerProduct(a, b) {
    const outer = Array(a.length);

    for (let r = 0; r < a.length; r++) {
        outer[r] = (Array(b.length));
        for (let c = 0; c < b.length; c++) {
            outer[r][c] = a[r] * b[c];
        }
    }

    return outer;
}

/**
 * [TODO: remove this if it's not needed]
 * Make a transposed copy of the provided 2D array.
 * @param {number[][]} matrix 2D array to be transposed
 * @returns {number[][]} transposed copy of `matrix`
 */
function transpose(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    const transposedMatrix = Array(cols);
    for (let c = 0; c < cols; c++) {
        transposedMatrix[c] = Array(rows);
        for (let r = 0; r < rows; r++) {
            transposedMatrix[c][r] = matrix[r][c];
        }
    }

    return transposedMatrix;
}

/**
 * Generate a linear sequence of `n` equally spaced floats from `a` through `b` inclusive.
 * @param {number} a float start bound of the sequence
 * @param {number} b float end bound of the sequence
 * @param {number} n integer number of items in the sequence
 * @returns {number[]} an array of `n` equally spaced floats from `a` through `b` inclusive
 */
function linearSequence(a, b, n) {
    if (!Number.isInteger(n) || n < 2) {
        throw new Error("Linear sequence length must be an integer and at least 2");
    }

    const step = (b - a) / (n - 1);
    const sequence = Array(n);

    for (let i = 0; i < n; i++) {
        sequence[i] = a + i * step;
    }

    return sequence;
}

function linearRamp(arrayA, arrayB, n) {
    return linearSequence(arrayA[arrayA.length - 1], arrayB[0], n);
}

/**
 * Create a piecewise sequence of linear subsequences with total length `n`. If `n` does not
 * divide evenly by `targets - 1` (the number of subsequences), give 1 unit of the extra
 * length to each subsequence starting from the left until it runs out.
 * @param {number[]} targets the values of the sequence at the ends of piecewise components
 * @param {number} n the integer number of values in the total sequence
 * @returns {number[]} a piecewise sequence of linear subsequences
 */
function piecewiseLinearSequence(targets, n) {
    const numSubsequences = targets.length - 1;

    if (!Number.isInteger(n) || n < 2 * numSubsequences) {
        throw new Error("Linear sequence length must be an integer and at least 2 times the number of subsequences");
    }

    let remainder = n % numSubsequences;
    const subsequenceLength = Math.floor(n / numSubsequences);

    const sequence = [];

    let bonusLength = 0;
    for (let i = 0; i < targets.length - 1; i++) {
        if (remainder > 0) {
            remainder--;
            bonusLength = 1;
        }

        const subsequence = linearSequence(targets[i], targets[i + 1], subsequenceLength + bonusLength);
        sequence.push(...subsequence);

        bonusLength = 0;
    }

    return sequence;
}

/**
 * Get random number from gaussian distribution using Box-Muller transform.
 * https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
 * @param {number} mean float mean of the distribution (default 0)
 * @param {number} stdev float standard deviation of the distribution (default 1)
 * @returns {number} random float from a gaussian distribution described by `mean` and `stdev`
 */
function gaussianRandom(mean=0, stdev=1) {
    const u = 1 - Math.random();  // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

/**
 * Get an array of random floats from gaussian distribution using Box-Muller transform.
 * @param {number} size integer size of the array (default 1)
 * @param {number} mean float mean of the distribution (default 0)
 * @param {number} stdev float standard deviation of the distribution (default 1)
 * @returns {number[]} array of random floats from a gaussian distribution described by `mean` and `stdev`
 */
function gaussianRandomArray(size=1, mean=0, stdev=1) {
    let array = [];
    for (let i = 0; i < size; i++) {
        array.push(gaussianRandom(mean, stdev));
    }
    return array;
}

// Legal parameter names
const PARAM_NAMES = [
    "FS", "DUR", "N_FORM", "N_SAMP", "DT", "F0", "FF", "BW", "AV", "AVS", "AH",
    "AF", "FNZ", "SW", "FGP", "BGP", "FGZ", "BGZ", "FNP", "BNP", "BNZ", "BGS", "A1",
    "A2", "A3", "A4", "A5", "A6", "AB", "AN"
];

// TODO: this klattMake/KlattParam workflow is really awkward.
//       Rewrite it to just use the KlattSynth constructor?
//       Store the KlattParam object in the synth?
/**
 * Create and setup a new KlattSynth.
 * @param {KlattParam} params parameter object to import params from
 * @returns {KlattSynth} a KlattSynth with params based on `params`
 */
function klattMake(params = new KlattParam()) {
    // Initialize synth
    const synth = new KlattSynth();

    // Loop through all time-varying parameters, processing as needed
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

function extendOrTruncate(array, newLength) {
    const oldLength = array.length;

    // if new_length <= old_length then we truncate and return
    array.length = newLength;

    // else must extend by duplicating last element
    if (oldLength < newLength) {
        for (let i = oldLength; i < newLength; i++) {
            array[i] = array[oldLength - 1];
        }
    }
}

/***** KLATT SYNTH & PARAMS *****/

class KlattParam {
    static DEFAULTS = {
        FS: 10000, N_FORM: 6, DUR: 0.5, F0: 100,
        FF: [500, 1500, 2500, 3500, 4500, 4900],
        BW: [50, 100, 100, 200, 250, 1000],
        AV: 60, AVS: 0, AH: 0, AF: 0,
        SW: 0,
        FGP: 0, BGP: 100, FGZ: 1500, BGZ: 6000, FNP: 250,
        BNP: 100, FNZ: 250, BNZ: 100, BGS: 200,
        A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0,
        AB: 0, AN: 0
    };

    static EXPECTED_SCALAR_PARAMS = ["FS", "DUR", "N_FORM"];
    static ALL_SCALAR_PARAMS = ["FS", "DUR", "N_SAMP", "DT", "N_FORM"];
    static ARRAY_PARAMS = ["F0", "AV", "AVS", "AH", "AF", "FNZ", "SW", "FGP", "BGP", "FGZ", "BGZ", "FNP", "BNP", "BNZ", "BGS", "A1", "A2", "A3", "A4", "A5", "A6", "AB", "AN"];
    static FORMANT_MATRICES = ["FF", "BW"];

    // TODO: Named params doesn't work in JS. Use a dict?
    /**
     * Create a new KlattParam.
     * Bandwidths/frequencies are in Hz.
     * Amplitudes are in dB.
     *
     * @param {number} FS       sample rate (samples/s)     (default 10000)
     * @param {number} N_FORM   number of formants          (default 5)
     * @param {number} DUR      duration (s)                (default 0.5)
     * @param {number} F0       fundemental (Hz)            (default 100)
     *      Transformed into array of F0 over time.
     * @param {number[]} FF     formants (Hz)               (default [500, 1500, 2500, 3500, 4500])
     *      Transformed into 2D array where each row is a formant frequency over time.
     * @param {number[]} BW     formant bandwidths          (default [50, 100, 100, 200, 250])
     *      Transformed into 2D array where each row is a formant bandwidth over time.
     *
     * All the following params generate 1D arrays to allow variance over time:
     * @param {number} AV       voicing ampl                (default 60)
     * @param {number} AVS      quasi-sinusoid voicing ampl (default 0)
     * @param {number} AH       aspiration ampl             (default 0)
     * @param {number} AF       frication ampl              (default 0)
     * @param {number} SW       cascade/parallel switch     (default 0) (0 or 1)
     * @param {number} FGP      glottal resonator 1 freq    (default 0)
     * @param {number} BGP      glottal resonator 1 BW      (default 100)
     * @param {number} FGZ      glottal zero freq           (default 1500)
     * @param {number} BGZ      glottal zero BW             (default 6000)
     * @param {number} FNP      nasal pole freq             (default 250)
     * @param {number} BNP      nasal pole BW               (default 100)
     * @param {number} FNZ      nasal zero freq             (default 250)
     * @param {number} BNZ      nasal zero BW               (default 100)
     * @param {number} BGS      glottal resonator 2 BW      (default 200)
     * @param {number} A1       parallel formant 1 ampl     (default 0)
     * @param {number} A2       parallel formant 2 ampl     (default 0)
     * @param {number} A3       parallel formant 3 ampl     (default 0)
     * @param {number} A4       parallel formant 4 ampl     (default 0)
     * @param {number} A5       parallel formant 5 ampl     (default 0)
     * @param {number} A6       parallel formant 6 ampl     (default 0)
     * @param {number} AB       bypass path ampl            (default 0)
     * @param {number} AN       nasal formant ampl          (default 0)
     */
    constructor(rawParamObject = {}) {
        // Apply defaults
        let params = {};
        for (const [key, defaultValue] of Object.entries(KlattParam.DEFAULTS)) {
            params[key] = (key in rawParamObject) ? rawParamObject[key] : defaultValue;
        }

        this.setMetadata(false, params.DUR, params.FS, params.N_FORM);

        for (const param of KlattParam.ARRAY_PARAMS) {
            this[param] = new Array(this.N_SAMP).fill(params[param]);
        }

        for (const matrix of KlattParam.FORMANT_MATRICES) {
            this[matrix] = params[matrix].map(entry => new Array(this.N_SAMP).fill(entry));
        }
    }

    setMetadata(applyToParams, durationS, sampleRate = undefined, numFormants = undefined) {
        sampleRate = (sampleRate === undefined ? this.FS : sampleRate);
        numFormants = (numFormants === undefined ? this.N_FORM : numFormants);

        this.FS = sampleRate;
        this.DUR = durationS;
        this.N_SAMP = Math.round(this.FS * this.DUR);
        this.DT = 1 / this.FS;
        this.N_FORM = numFormants;

        if (applyToParams) {
            for (const param of KlattParam.ARRAY_PARAMS) {
                extendOrTruncate(this[param], this.N_SAMP);
            }

            for (const matrix of KlattParam.FORMANT_MATRICES) {
                this[matrix].forEach(row => extendOrTruncate(row, this.N_SAMP));
            }
            console.warn(this.FGP);
        }
    }

    assertCanAppend(klattParam) {
        if (klattParam.FS !== this.FS || klattParam.N_FORM !== this.N_FORM) {
            throw new Error("Sample rate FS and number of formants N_FORM must be the same to append KlattParam objects");
        }
    }

    append(klattParam) {
        this.assertCanAppend(klattParam);

        this.setMetadata(false, this.DUR + klattParam.DUR);

        for (let i = 0; i < this.N_FORM; i++) {
            this.FF[i] = this.FF[i].concat(klattParam.FF[i]);
            this.BW[i] = this.BW[i].concat(klattParam.BW[i]);
        }

        for (const param of KlattParam.ARRAY_PARAMS) {
            this[param] = this[param].concat(klattParam[param]);
        }

        // Enable daisy chaining
        return this;
    }

    rampTo(klattParam, rampDurationS = 0.25) {
        this.assertCanAppend(klattParam);

        let ramp = new KlattParam();

        ramp.setMetadata(false, rampDurationS, this.FS, this.N_FORM);

        for (let i = 0; i < ramp.N_FORM; i++) {
            ramp.FF[i] = linearRamp(this.FF[i], klattParam.FF[i], ramp.N_SAMP);
            ramp.BW[i] = linearRamp(this.BW[i], klattParam.BW[i], ramp.N_SAMP);
        }

        for (const param of KlattParam.ARRAY_PARAMS) {
            ramp[param] = linearRamp(this[param], klattParam[param], ramp.N_SAMP);
        }

        this.append(ramp);
        this.append(klattParam);

        return this;
    }

    clone() {
        let paramsClone = new KlattParam();

        paramsClone.setMetadata(false, this.DUR, this.FS, this.N_FORM);

        for (const param of KlattParam.ARRAY_PARAMS) {
            paramsClone[param] = [...this[param]];
        }

        for (const matrix of KlattParam.FORMANT_MATRICES) {
            paramsClone[matrix] = this[matrix].map(row => [...row]);
        }

        return paramsClone;
    }
}

class KlattSynth {
    /**
     * Create new KlattSynth.
     */
    constructor() {
        // Create name
        this.name = "Klatt Formant Synthesizer";

        // Create empty attributes
        this.output = null;
        this.sections = null;

        // Create synthesis parameters array
        const paramList = [
            "F0", "AV", "OQ", "SQ", "TL", "FL",             // Source
            "DI", "AVS", "AV", "AF", "AH",                  // Source
            "FF", "BW",                                     // Formants
            "FGP", "BGP", "FGZ", "BGZ", "BGS",              // Glottal pole/zero
            "FNP", "BNP", "FNZ", "BNZ",                     // Nasal pole/zero
            "FTP", "BTP", "FTZ", "BTZ",                     // Tracheal pole/zero
            "A2F", "A3F", "A4F", "A5F", "A6F",              // Frication parallel
            "B2F", "B3F", "B4F", "B5F", "B6F",              // Frication parallel
            "A1V", "A2V", "A3V", "A4V", "ATV",              // Voicing parallel
            "A1", "A2", "A3", "A4", "A5", "A6", "AB", "AN", // 1980 parallel
            "ANV",                                          // Voicing parallel
            "SW", "INV_SAMP",                               // Synth settings
            "N_SAMP", "FS", "DT"                            // Synth settings
        ];

        // Initialize params with null values
        this.params = {};
        for (const param of paramList) {
            this.params[param] = null;
        }
    }

    /**
     * Create the network for this synth.
     */
    setup() {
        // Initialize data vectors
        this.output = new Array(this.params["N_SAMP"]).fill(0);

        // Initialize sections
        this.voice = new KlattVoice(this);
        this.noise = new KlattNoise(this);
        this.cascade = new KlattCascade(this);
        this.parallel = new KlattParallel(this);
        this.radiation = new KlattRadiation(this);
        this.outputModule = new OutputModule(this);

        // Create section-level connections
        this.voice.connect([this.cascade, this.parallel]);
        this.noise.connect([this.cascade, this.parallel]);
        this.cascade.connect([this.radiation]);
        this.parallel.connect([this.radiation]);
        this.radiation.connect([this.outputModule]);

        // Put all section objects into this.sections for reference
        this.sections = [
            this.voice, this.noise, this.cascade,
            this.parallel, this.radiation, this.outputModule
        ];

        // Patch all components together within sections
        for (const section of this.sections) {
            section.patch();
        }
    }

    /**
     * Run the synth to generate its output.
     */
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

    /**
     * Play the output of this synth.
     */
    async play(ctx) {
        console.log("Final output: ", this.output);

        await playSamples(ctx, this.output, 10000);
    }
}

/***** BASE CLASSES *****/

// TODO: don't pass the entire synth to all its children, we only need the params!
class KlattComponent {
    /**
     * Create a new KlattComponent.
     * @param {KlattSynth} mast the synth this component is in, used exclusively for params
     * @param {KlattComponent[]} dests array of components that this component outputs to
     */
    constructor(mast, dests = []) {
        this.mast = mast;  // KlattSynth
        this.dests = dests;  // KlattComponent[]
        this.input = new Array(this.mast.params["N_SAMP"]).fill(0);
        this.output = new Array(this.mast.params["N_SAMP"]).fill(0);
    }

    /**
     * Set the input of this component to `signal`.
     * @param {number[]} signal float array output from the previous components
     */
    receive(signal) {
        this.input = [...signal];
    }

    /**
     * Send this component's output to each of its dests.
     */
    send() {
        console.log(`\t${this.constructor.name} sends`, [
            ...this.output.slice(0, 4),
            "||",
            ...this.output.slice(-4)
        ]);

        for (const dest of this.dests) {
            dest.receive([...this.output]);
        }
    }

    /**
     * Connect this component's output to the provided components.
     * @param {KlattComponent[]} components components to attach as this component's destinations
     */
    connect(components) {
        for (const component of components) {
            this.dests.push(component);
        }
    }

    /**
     * Zero the input and output of this component.
     */
    clean() {
        this.input.fill(0);
        this.output.fill(0);
    }
}

class KlattSection {
    /**
     * Create a new KlattSection.
     * @param {KlattSynth} mast the synth this component is in, used exclusively for params
     */
    constructor(mast) {
        this.mast = mast;  // KlattSynth
        this.components = [];  // KlattComponent[]
        this.ins = [];  // Buffer[]
        this.outs = [];  // Buffer[]
    }

    /**
     * Connect this section's output to the provided sections' inputs.
     * @param {KlattSection[]} sections sections to output to through a pair of buffers 
     */
    connect(sections) {
        for (const section of sections) {
            const buffer = new Buffer(this.mast);
            section.ins.push(buffer);
            this.outs.push(new Buffer(this.mast, [buffer]));
        }
    }

    /**
     * Process the this section's input buffers.
     */
    processIns() {
        for (const inEl of this.ins) {
            inEl.process();
        }
    }

    /**
     * Process this section's output buffers.
     */
    processOuts() {
        for (const out of this.outs) {
            out.process();
        }
    }

    /**
     * Process this section's buffers and run its do() function.
     */
    run() {
        if (this.ins !== null && this.ins.length > 0) {
            this.processIns();
        }
        this.do();
        if (this.ins !== null && this.outs.length > 0) {
            this.processOuts();
        }
    }

    /**
     * Section dependent. Should connect this section's components.
     */
    patch() {
        throw new Error("UNIMPLEMENTED: This KlattSection has no patch() implementation!");
    }

    /**
     * Section dependent. Should run this section's components and
     * set the inputs of this section's output buffers.
     */
    do() {
        throw new Error("UNIMPLEMENTED: This KlattSection has no do() implementation!");
    }
}

/***** SECTIONS *****/

class KlattVoice extends KlattSection {
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

        console.log("KlattVoice outputs", [...this.switch.output]);
    }
}

class KlattNoise extends KlattSection {
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
        this.amp.amplify(-130);  // TODO: -60 might not be real value

        console.log("KlattNoise outputs", [...this.amp.output])
    }
}

class KlattCascade extends KlattSection {
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

class KlattParallel extends KlattSection {
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
        this.a6 = new Amplifier(mast);
        this.r6 = new Resonator(mast);
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
        this.a6.connect([this.r6]);
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
        this.a6.amplify(this.mast.params["A6"]);
        this.r6.resonate(this.mast.params["FF"][5], this.mast.params["BW"][5]);
        this.ab.amplify(this.mast.params["AB"]);
        this.outputMixer.mix();

        console.log("KlattParallel outputs", [...this.outputMixer.output])
    }
}

class KlattRadiation extends KlattSection {
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
    /**
     * Create a new Buffer.
     * @param {KlattSynth} mast the synth this component is in, used exclusively for params
     * @param {KlattComponent[]} dests array of components that this component outputs to
     */
    constructor(mast, dests = []) {
        super(mast, dests);
    }

    /**
     * Copy this Buffer's input to its output, then send the output to its destinations.
     */
    process() {
        this.output = [...this.input];
        this.send();
    }
}

class Resonator extends KlattComponent {
    /**
     * Create a new Resonator.
     * @param {KlattSynth} mast the synth this component is in, used exclusively for params
     * @param {boolean} anti true if this resonator should be an antiresonator
     */
    constructor(mast, anti = false) {
        super(mast);
        this.anti = anti;
    }

    /**
     * Get coefficient arrays that vary over time to apply to this Resonator's input.
     * @param {number[]} ffs 1D array of a formant's freqencies over time
     * @param {number[]} bws 1D array of a formant's bandwidth over time
     * @returns {number[][]} array of three coefficient arrays to apply to this Resonator's input
     */
    calcCoef(ffs, bws) {
        const piDT = Math.PI * this.mast.params["DT"];

        let c = [];
        let b = [];
        let a = [];
        for (let i = 0; i < bws.length; i++) {
            c.push(-Math.exp(-2 * piDT * bws[i]));
            b.push(2 * Math.exp(-piDT * bws[i]) * Math.cos(2 * piDT * ffs[i]));
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

            return [aPrime, bPrime, cPrime];
        }
        else {
            return [a, b, c];
        }
    }

    /**
     * Filter the input and send the result to this Resonator's destinations.
     * @param {number[]} ffs 1D array of a formant's freqencies over time
     * @param {number[]} bws 1D array of a formant's bandwidth over time
     */
    resonate(ffs, bws) {
        const [a, b, c] = this.calcCoef(ffs, bws);
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
    }

    /**
     * Generate glottal impulses with varying frequency F0, then send the result to destinations.
     * @param {number[]} F0 array of frequencies of F0 over time
     */
    impulseGen(F0) {
        let glotPeriod = [];
        for (const F0El of F0) {
            glotPeriod.push(Math.round(this.mast.params["FS"] / F0El));
        }

        let lastGlotPulse = 0;
        for (let i = 0; i < this.mast.params["N_SAMP"]; i++) {
            if (i - lastGlotPulse >= glotPeriod[i]) {
                this.output[i] = 1;
                lastGlotPulse = i;
            }
        }

        this.send();
    }
}

class Mixer extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    /**
     * Add (i.e. elementwise sum) the signal to the input of this Mixer.
     * @param {number[]} signal float array output from the previous components
     */
    receive(signal) {
        this.input = [...this.input];
        for (let i = 0; i < this.input.length; i++) {
            this.input[i] += signal[i];
        }
    }

    /**
     * Copy the input to the output and send the output to destinations.
     */
    mix() {
        this.output = [...this.input];
        this.send();
    }
}

class Amplifier extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    /**
     * Amplify the input by the provided `dB` scalar or time-varying array
     * of dB, then send output to destinations.
     * @param {number | number[]} dB amplification scalar or array
     */
    amplify(dB) {
        if (dB instanceof Array) {
            dB = dB.map(dBEl => Math.sqrt(10) ** (dBEl / 10));
            this.output = [];
            for (let i = 0; i < dB.length; i++) {
                this.output.push(this.input[i] * dB[i]);
            }
        }
        else {
            dB = Math.sqrt(10) ** (dB / 10)
            this.output = this.input.map(inEl => inEl * dB);
        }
        this.send();
    }
}

class Firstdiff extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    /**
     * Set the output to the difference between the input and the input shifted
     * right by one element, then send output to destinations.
     */
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

    /**
     * Set the output to the input after applying a lowpass filter,
     * then send output to destinations.
     */
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

    /**
     * Normalize the input by dividing by the max magnitude element,
     * set the output to the normalized result, then send the output
     * to destinations.
     */
    normalize() {
        const absMax = Math.max(...this.input.map(Math.abs));
        if (absMax === 0) {
            console.warn("Max value was 0, skipping normalization");
            this.output = [...this.input];
        }
        else {
            this.output = this.input.map(inputEl => inputEl / absMax);
        }
        this.send();
    }
}

class Noisegen extends KlattComponent {
    constructor(mast) {
        super(mast);
    }

    /**
     * Set output to gaussian noise, then send output to destinations.
     */
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

    /**
     * Send the first subarray of output to the first dest,
     * and the second subarray of output to the second dest.
     */
    send() {
        this.dests[0].receive([...this.output[0]]);
        this.dests[1].receive([...this.output[1]]);
    }

    /**
     * At time i:
     *  If choice[i] is 0: set output[0][i] to input[i]
     *  If choice[i] is 1: set output[1][i] to input[i]
     * Otherwise all output elements are 0.
     * Then send the first subarray in output to the first destination, and vice versa.
     * @param {number[]} choice array of 0s and 1s, representing the branch to take at each time
     */
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

    /**
     * Fill both output subarrays with 0.
     */
    clean() {
        this.output = [];
        this.output.push(new Array(this.mast.params["N_SAMP"]).fill(0));
        this.output.push(new Array(this.mast.params["N_SAMP"]).fill(0));
    }
}

// Some chars have multiple identical-looking unicode values
const REPLACEMENTS = {
    "ε": "ɛ"  // Greek epsilon -> Latin epsilon
}

const PHONES = {
    "i": new Monophthong([310, 2020, 2960], [45, 200, 400]),
    "ɚ": new Monophthong([310, 1060, 1380], [70, 100, 120]),
    "ɪ": new Monophthong([400, 1900, 2570], [50, 100, 140]),
    "ɛ": new Monophthong([620, 1660, 2430], [70, 130, 300]),
    "æ": new Monophthong([700, 1560, 2430], [70, 130, 320]),
    "ɑ": new Monophthong([700, 1220, 2600], [130, 70, 160]),
    "ʊ": new Monophthong([400, 890, 2100], [50, 100, 80]),
    "ʌ": new Monophthong([700, 1220, 2570], [70, 50, 140]),
    "a": new Monophthong([700, 1560, 2430], [70, 130, 320]),
    "ɒ": new Monophthong([620, 850, 2570], [70, 50, 140]),
    "ə": new Monophthong([460, 1400, 2570], [90, 110, 80]),
    "y": new Monophthong([310, 1700, 2400], [50, 100, 200]),
    "ɨ": new Monophthong([320, 1700, 2300], [60, 120, 300]),
    "ʉ": new Monophthong([320, 1600, 2400], [50, 100, 250]),
    "ɯ": new Monophthong([320, 1300, 2200], [60, 110, 180]),
    "u": new Monophthong([300, 870, 2240], [50, 90, 180]),
    "ʏ": new Monophthong([360, 1900, 2500], [70, 120, 200]),
    "e": new Monophthong([500, 1800, 2600], [60, 110, 300]),
    "ø": new Monophthong([450, 1600, 2400], [60, 100, 200]),
    "ɘ": new Monophthong([470, 1400, 2400], [70, 130, 210]),
    "ɵ": new Monophthong([450, 1200, 2200], [70, 110, 200]),
    "ɤ": new Monophthong([460, 1300, 2200], [80, 110, 180]),
    "o": new Monophthong([340, 800, 2300], [70, 80, 200]),
    "œ": new Monophthong([550, 1500, 2400], [70, 120, 200]),
    "ɜ": new Monophthong([550, 1400, 2400], [80, 110, 200]),
    "ɞ": new Monophthong([540, 1300, 2200], [80, 110, 200]),
    "ɔ": new Monophthong([500, 900, 2400], [70, 80, 200]),
    "ɐ": new Monophthong([600, 1200, 2400], [80, 100, 220]),
    "ɶ": new Monophthong([650, 1400, 2500], [90, 120, 250]),

    "s": new Fricative().setAF(60).setAV(0).setAmp(6, 52),
    "z": new Fricative().setAF(45).setAV(40).setAmp(6, 52),
    "ʃ": new Fricative(185).setAF(55).setAV(0).setAmps([3, 4, 5, 6], [57, 48, 48, 46]),
    "ʒ": new Fricative().setAF(53).setAV(47).setAmps([2, 3, 4, 5, 6], [48, 48, 48, 41, 53]),
    "f": new Fricative().setAF(60).setAV(0).setAB(57),
    "v": new Fricative().setAF(50).setAV(50).setAB(57),
    "θ": new Fricative().setAF(65).setAV(0).setAmps([2, 6], [13, 29]).setAB(48),
    "ð": new Fricative().setAF(55).setAV(35).setAmp(6, 27).setAB(48),

    //Nasals
    "m": new Nasal([250, 1200, 2200], [60, 80, 150], [500, 1500]),
    "ɱ": new Nasal([250, 1100, 2000], [60, 90, 140], [450, 1300]),
    "ɴ": new Nasal([200, 1100, 2000], [70, 100, 160], [400, 1300]),
    //TODO: N sounds needs work
    "n": new Nasal([300, 1600, 2400], [50, 70, 140], [750, 1750]),
    "ɳ": new Nasal([250, 1500, 2300], [50, 90, 150], [650, 1650]),
    "ɲ": new Nasal([300, 2000, 2500], [50, 100, 170], [850, 1850]), 
    "ŋ": new Nasal([300, 1300, 2200], [50, 80, 140], [650, 1550]), 
};

export async function playWord(ctx, word) {
    let params = null;
    let lastPhoneParams = null;

    for (let i = 0; i < word.length; i++) {
        let grapheme = word[i];

        grapheme = REPLACEMENTS[grapheme] || grapheme;

        // Converts ə˞  to ɚ ("rrrrr")
        // TODO: do a single sweep through the whole string to create
        //       grapheme objects with properties describing their diacritics
        if (grapheme === "ə" && i < word.length - 1 && word[i+1] === "˞") {
            grapheme = "ɚ";
            i++;
        }

        let phone = PHONES[grapheme]
        if (phone !== undefined) {
            // Fade in on first phone
            if (params === null) {
                lastPhoneParams = phone.makeParams();

                // Create "stub" params w/the same values,
                //  just shorter & w/amplitudes of 0
                params = lastPhoneParams.clone();
                params.setMetadata(true, 0.01);
                params.AV = new Array(params.N_SAMP).fill(0);
                params.AF = new Array(params.N_SAMP).fill(0);

                // Ramp from stub to real params
                // Creates fade in effect w/o changing phone quality
                params.rampTo(lastPhoneParams, 0.05);
            }
            else {
                lastPhoneParams = phone.makeParams();
                params.rampTo(lastPhoneParams, 0.02);
            }
        }
    }

    if (params === null) {
        console.log("No legal phones in word");
        return;
    }

    // Fade out after last phone
    const tailStub = lastPhoneParams.clone();
    tailStub.setMetadata(true, 0.01);
    tailStub.AV = new Array(tailStub.N_SAMP).fill(0);
    tailStub.AF = new Array(tailStub.N_SAMP).fill(0);

    params.rampTo(tailStub, 0.05);

    // Consistant F0 fall across whole word
    params.F0 = linearSequence(120, 70, params.N_SAMP);

    const synth = klattMake(params);
    synth.run();
    await synth.play(ctx);
}
