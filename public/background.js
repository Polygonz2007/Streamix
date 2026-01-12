//  background.js
//
//  Used for displaying cool background
//

// Kernel brooo
const Convolver = class {
    constructor(context, kernel_x, kernel_y) {
        this.context = context;
        this.kernel_x = kernel_x;
        this.kernel_y = kernel_y;

        // Prepare
        this.image_data;
        this.width;
        this.height;
    }

    convolve() {
        this.get_pixel_data();
        this.errors = 0;

        // First convolution (Horizontal)
        let buffer = this.image_data;
        let kernel_size = this.kernel_x.length;
        let offset = Math.round(kernel_size / 2);
        console.log(`kernel is ${kernel_size} and offset is ${offset}`)

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                // Get all nesecarry colors
                let result = { r: 0, g: 0, b: 0, a: 255 };
                for (let i = 0; i < kernel_size; i++) {
                    let col = this.sample(buffer, x - offset + i, y);
                    result.r += col.r * this.kernel_x[i];
                    result.g += col.g * this.kernel_x[i];
                    result.b += col.b * this.kernel_x[i];
                }

                this.set(x, y, result);
            }
        }

        this.context.putImageData(this.image_data, 0, 0);

        // Second convolution (Vertical)
        buffer = this.image_data;
        kernel_size = this.kernel_y.length;
        offset = Math.round(kernel_size / 2);

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                // Get all nesecarry colors
                let result = { r: 0, g: 0, b: 0, a: 255 };
                for (let i = 0; i < kernel_size; i++) {
                    let col = this.sample(buffer, x, y - offset + i);
                    result.r += col.r * this.kernel_x[i];
                    result.g += col.g * this.kernel_x[i];
                    result.b += col.b * this.kernel_x[i];
                }

                this.set(x, y, result);
            }
        }

        this.context.putImageData(this.image_data, 0, 0);
        console.log(`errors: ${this.errors}`)
        return true;
    }

    get_pixel_data() {
        this.width = this.context.canvas.width;
        this.height = this.context.canvas.height;
        this.image_data = this.context.getImageData(0, 0, this.width, this.height);
        this.data = this.image_data.data;
    }

    sample(image_data, x, y) {
        if (x < 0)
            x = -x;
        if (y < 0)
            y = -y;

        if (x >= this.width)
            x = this.width - 1;
        if (y >= this.height)
            y = this.height - 1;

        const index = ((y * this.width) + x) * 4;
        if (image_data.data[index] == undefined)
            this.errors++;

        return {
            r: image_data.data[index + 0],
            g: image_data.data[index + 1],
            b: image_data.data[index + 2],
            a: image_data.data[index + 3]
        }
    }

    set(x, y, col) {
        const index = ((y * this.width) + x) * 4;
        this.image_data.data[index + 0] = col.r;
        this.image_data.data[index + 1] = col.g;
        this.image_data.data[index + 2] = col.b;
        this.image_data.data[index + 3] = col.a;
    }
}

const Background = new class {
    constructor() {
        // SETTINGS //
        this.downsample = 8;
        this.fade_time = 120; // frames


        // FUNCTIONALITY //
        // Get background
        this.canvas = document.querySelector("#background");
        this.temp_canvas = document.querySelector("#temp-background");

        this.context = this.canvas.getContext("2d");
        this.temp_context = this.temp_canvas.getContext("2d");

        // Get screen size and set canvas size
        this.screen = { width: 0, height: 0 };
        this.prev_screen = this.screen;
        this.update_dims();

        this._src = "";

        // Get temp contxt
        //this.temp_canvas = document.createElement("canvas");
        //this.temp_context = this.temp_canvas.getContext("2d");
    }

    update_dims() {
        this.prev_screen = {
            width: this.screen.width,
            height: this.screen.height // JAVASCRIPT DEEP COPY AHHH
        };

        this.screen = {
            width: window.innerWidth / this.downsample * window.devicePixelRatio,
            height: window.innerHeight / this.downsample * window.devicePixelRatio
        };

        if (this.screen == this.prev_screen)
            return;

        this.canvas.width = this.screen.width;
        this.canvas.height = this.screen.height;

        this.temp_canvas.width = this.screen.width;
        this.temp_canvas.height = this.screen.height;
    }

    get src() {
        return this._src;
    }

    set src(val) {
        if (this.src == val)
            return;

        this._src = val;
        if (!this.src)
            this.clear();
        else
            this.render();
    }

    gaussian(x, mu, sigma ) {
        const a = ( x - mu ) / sigma;
        return Math.exp(-0.5 * a * a);
    }

    // Blurs the image.
    blur(sigma) {
        const GAUSSKERN = 6.0;
        let dim = parseInt(Math.max(3.0, GAUSSKERN * sigma));
        let sqrtSigmaPi2 = Math.sqrt(Math.PI*2.0)*sigma;
        let s2 = 2.0 * sigma * sigma;
        let sum = 0.0;
        
        let kernel = new Float32Array(dim - !(dim & 1)); // Make it odd number
        const half = parseInt(kernel.length / 2);
        for (let j = 0, i = -half; j < kernel.length; i++, j++) 
        {
            kernel[j] = Math.exp(-(i*i)/(s2)) / sqrtSigmaPi2;
            sum += kernel[j];
        }

        // Normalize the gaussian kernel to prevent image darkening/brightening
        for (let i = 0; i < dim; i++) {
            kernel[i] /= sum;
        }

        // Convolve
        const convolver = new Convolver(this.temp_context, kernel, kernel);
        convolver.convolve();
        
        return true;
    }

    // Changes the brightness of the image.
    brightness_and_contrast(brightness, contrast) {
        const image_data = this.temp_context.getImageData(0, 0, this.screen.width, this.screen.height);
        const offset = 255 * (1 - contrast) / 2;

        // Brightness
        for (let i = 0; i < image_data.data.length; i += 4) {
            image_data.data[i+0] = offset + (image_data.data[i+0] * contrast) * brightness;
            image_data.data[i+1] = offset + (image_data.data[i+1] * contrast) * brightness;
            image_data.data[i+2] = offset + (image_data.data[i+2] * contrast) * brightness;
            image_data.data[i+3] = image_data.data[i+3];
        }

        this.temp_context.putImageData(image_data, 0, 0); 
        return true;
    }

    // Puts the result onto the canvas object.
    async render() {
        Background.update_dims();
        
        // Load image onto temp_buffer and fade to it
        // BUT FIRST just load the fucking image
        let img = new Image();
        await new Promise(r => img.onload=r, img.src=this.src);

        // Then draw to canvas cropped!
        const aspect = this.screen.width / this.screen.height;
        let start_x = 0, start_y = 0;
        let size_x = img.width, size_y = img.height;

        if (aspect > 1) {
            // Crop top and bottom.
            const cut_amount = img.height * (1 - (1 / aspect));
            start_y = cut_amount / 2;
            size_y = img.height - cut_amount;
        } else {
            // Crop sides.
            const cut_amount = img.width * (1 - aspect);
            start_x = cut_amount / 2;
            size_x = img.width - cut_amount;
        }

        // Draw the image but flipped
        this.temp_context.scale(-1, 1);
        this.temp_context.drawImage(img, start_x, start_y, size_x, size_y, 0, 0, -this.screen.width, this.screen.height);

        // Blur
        const blur_percent = 0.05; //0.035;
        this.blur(Math.ceil(Math.max(this.screen.width, this.screen.height) * blur_percent));

        // Brightness and contrast
        this.brightness_and_contrast(0.5, 0.95);

        this.fade_in_update(200);
    }

    clear(instant) {
        console.log("CLEAR WAS CALLED")
        this.update_dims();
        this.temp_context.fillStyle = "#000";
        this.temp_context.fillRect(0, 0, this.screen.width, this.screen.height);
        this.fade_in_update(instant ? 0 : 200);
    }

    fade_in_update(duration) {
        if (duration < 0)
            duration = 0;

        this.temp_canvas.style.opacity = `0`;
        let frame_index = 0;
        
        function frame() {
            frame_index++;
            if (frame_index > duration) {
                // Move temp to main for next fade
                this.context.drawImage(this.temp_canvas, 0, 0);
                this.temp_canvas.style.opacity = `0`;

                return;
            }
                
            this.temp_canvas.style.opacity = `${frame_index / duration}`;
            requestAnimationFrame(frame);
        }

        frame = frame.bind(this);
        frame();
    }
}

export default Background;
Background.clear(true);

window.addEventListener("resize", () => {
    //console.log("ipdate")
    //Background.update_dims();
    //Background.context.drawImage(Background.temp_canvas, 0, 0);
//
    //if (Background.screen.width == Background.prev_screen.width && Background.screen.height == Background.prev_screen.height) // if nesecarry, re render (wait a few frames i guess)
        Background.render(); //console.log("render")
});