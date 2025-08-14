
const Utils = new class {
    wait = ms => new Promise(res => setTimeout(res, ms));
}

export default Utils;