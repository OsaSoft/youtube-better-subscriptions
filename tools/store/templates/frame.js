// Fits a 2x capture into its .frame (scaled to fit, centred, the frame's background showing
// around it) and draws the callouts: boxes in the capture's CSS pixels with a label.
//   ?img=<capture>&bg=<frame colour>&dark=1&callouts=<JSON [{x, y, w, h, label, side: below|above|left}]>
function placeCapture() {
    const params = new URLSearchParams(location.search);
    const frame = document.querySelector('.frame');
    const img = frame.querySelector('.capture');
    frame.style.background = params.get('bg') || '#ffffff';
    // a dark capture needs a lighter edge to stand off the dark background
    frame.classList.toggle('dark', params.get('dark') === '1');
    return new Promise((resolve, reject) => {
        img.onerror = reject;
        img.onload = () => {
            const fw = frame.clientWidth;
            const fh = frame.clientHeight;
            const cw = img.naturalWidth / 2;
            const ch = img.naturalHeight / 2;
            const s = Math.min(fw / cw, fh / ch);
            const ox = (fw - cw * s) / 2;
            const oy = (fh - ch * s) / 2;
            Object.assign(img.style, { left: ox + 'px', top: oy + 'px', width: cw * s + 'px', height: ch * s + 'px' });
            for (const c of JSON.parse(params.get('callouts') || '[]')) {
                const box = document.createElement('div');
                box.className = 'callout';
                Object.assign(box.style, { left: ox + c.x * s + 'px', top: oy + c.y * s + 'px', width: c.w * s + 'px', height: c.h * s + 'px' });
                frame.appendChild(box);
                if (!c.label) continue;
                const label = document.createElement('div');
                label.className = 'callout-label';
                label.textContent = c.label;
                frame.appendChild(label);
                let left, top;
                if (c.side === 'left') {
                    left = ox + c.x * s - label.offsetWidth - 14;
                    top = oy + (c.y + c.h / 2) * s - label.offsetHeight / 2;
                } else {
                    const cx = ox + (c.x + c.w / 2) * s;
                    left = Math.max(12, Math.min(fw - label.offsetWidth - 12, cx - label.offsetWidth / 2));
                    top = c.side === 'above' ? oy + c.y * s - label.offsetHeight - 12 : oy + (c.y + c.h) * s + 12;
                }
                Object.assign(label.style, { left: left + 'px', top: top + 'px' });
            }
            resolve();
        };
        img.src = params.get('img');
    });
}
