
// Holds some data for some settings, and can also change other parts of the system to do settings
// Also has JSON settings thingamajiggy /maybe in a different file tho

const Settings = new class {
    constructor() {
        this.keys = {
            "pause": " ",
            "next": "ArrowRight",
            "previous": "ArrowLeft"
        }
    }
}

export default Settings;
