
const Utils = new class {
    wait = ms => new Promise(res => setTimeout(res, ms));

    clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    smoothstep(a, b, t) {
        t = this.clamp((t - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
    }

    smoothlerp(a, b, t) {
        t = this.smoothstep(0, 1, t);
        return a + (b - a) * t;
    }

    byte_size_string(bytes, pres, upper) {
        pres = pres || 2;
        upper = upper || false;

        const s = ["b", "kb", "mb", "gb", "tb", "pb"];
        let i = 0;

        while (bytes > 1000) {
            bytes /= 1000;
            i++;
        }

        let string = bytes.toFixed(i > 0 ? pres : 0);
        string += " " + s[i];

        if (upper) string = string.toUpperCase();
        return string;
    }

    number_to_readable_string(number) {
        let result = "";
        const nstring = number.toString();

        let c = 0;
        for (let i = nstring.length - 1; i >= 0; i--) {
            result = nstring[i] + result;
            c++;
            if (c >= 3) {
                console.log("h")
                result = " " + result;
                c = 0;
            }
        }

        return result;
    }

    seconds_to_mmss(t) {
        // 1, 5
        const seconds = Math.round(t % 60).toString();
        const minutes = Math.round(t / 60).toString();

        // 01, 05
        if (seconds.length == 1) seconds = "0" + seconds;
        if (minutes.length == 1) minutes = "0" + minutes;

        // 01:05
        return `${minutes}:${seconds}`;
    }
}

export default Utils;
window.util = Utils;