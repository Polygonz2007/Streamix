
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
}

export default Utils;
window.util = Utils;