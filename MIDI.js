const NOTE_OFF = 8;
const NOTE_ON = 9;


export class Note {

    constructor(key = 0, velocity = 0, timestamp = Date.now()) {
        this.key = key;
        this.velocity = velocity;
        this.timestamp = timestamp;
        this._duration = null; // private state for getter use
    }

    get duration() {
    
        // If no _duration is available, compute note duration so far.
        // If _duration has been set, i.e. note has ended, return _duration.
    
        if (this._duration == null) {
            return Date.now() - this.timestamp;
        } else {
            return this._duration;
        }
    }
}



export default class MIDI extends EventTarget {

    constructor() {

        super();
        this._midiAccess = null;
        this.playing = new Map();
        
        // listeners for low-level MIDI keyboard keypresses

        this.addEventListener('_noteon', ({detail: {key, velocity, timestamp}}) => {

            // beforenoteon is triggered before MIDI state is updated;
            // a bona fide Note is nevertheless passed as event detail
            const note = new Note(key, velocity, timestamp);
            this.dispatchEvent(new CustomEvent('beforenoteon', {detail: note}));

            // noteon is triggered after state update
            this.playing.set(key, note);
            this.dispatchEvent(new CustomEvent('noteon', {detail: note}));
        });

        this.addEventListener('_noteoff', ({detail: {key, velocity, timestamp}}) => {

            // beforenoteoff is triggered before MIDI state is updated,
            // note is however updated (duration is set)
            const note = this.playing.get(key)
            note._duration = note.duration; // setting duration by a cute getter hack
            this.dispatchEvent(new CustomEvent('beforenoteoff'), {detail: note});

            // noteoff is triggered after state update (note deleted from active notes)
            this.playing.delete(key);
            this.dispatchEvent(new CustomEvent('noteoff', {detail: note}));
        });

    }

    // initialize is called to setup MIDI access and basic listeners:
    // 1. request access to MIDI subsystem
    // 2. loop over inputs and add a listener for MIDI messages
    // 3. parse any incoming messages and dispatch for further processing

    async initialize() {
    
        // initialize only once
        if (this._midiAccess != null) {
            return;
        }

        // bail out if no MIDI support    
        if (typeof navigator.requestMIDIAccess != 'function') {
            throw new Error('navigator.requestMIDIAccess is not a function');
        }
    
        this._midiAccess = await navigator.requestMIDIAccess();
        this._midiAccess = midiAccess;
        for (const input of midiAccess.inputs.values()) {
        
            // a listener for raw MIDI events; parses and preprocesses
            // events, passes keyboard presses forward (currently doesn't
            // trigger other events)
        
            input.addEventListener('midimessage', (midiMessage) => {

                // parse the raw message
                let command = Number(midiMessage.data[0] >> 4);
                const key = Number(midiMessage.data[1]);
                const velocity = Number((midiMessage.data.length > 2) ? midiMessage.data[2] : 1);

                // some devices send NOTE_ON with velocity 0 instead of NOTE_OFF
                if (velocity === 0) {
                    command = NOTE_OFF;
                }

                // dispatch event, depending on MIDI command
                if (command === NOTE_ON) {
                    this.dispatchEvent(new CustomEvent('_noteon', {detail: {
                        key: key,
                        velocity: Math.max(1, velocity), // NOTE_ON velocity never 0
                        timestamp: Date.now(),
                    }}));
                } else if (command === NOTE_OFF) {
                    this.dispatchEvent(new CustomEvent('_noteoff', {detail: {
                        key: key,
                        velocity: 0, // NOTE_OFF velocity always 0
                        timestamp: Date.now(),
                    }}));
                }
            });
        }
        this.dispatchEvent(new CustomEvent('midiaccess'));
    }
}




