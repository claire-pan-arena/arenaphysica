#!/usr/bin/env python3
"""
ffmpeg GUI wrapper for converting MP4/MOV to GIF
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import subprocess
import threading
import os
import shutil


def check_ffmpeg():
    return shutil.which("ffmpeg") is not None


class GifConverter(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MP4/MOV → GIF Converter")
        self.resizable(False, False)
        self.configure(padx=20, pady=20)

        self._build_ui()
        self._update_output_path()

    def _build_ui(self):
        # --- Input file ---
        tk.Label(self, text="Input file", anchor="w").grid(row=0, column=0, sticky="w", pady=(0, 2))
        input_frame = tk.Frame(self)
        input_frame.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 12))

        self.input_var = tk.StringVar()
        self.input_var.trace_add("write", lambda *_: self._update_output_path())
        tk.Entry(input_frame, textvariable=self.input_var, width=52).pack(side="left", fill="x", expand=True)
        tk.Button(input_frame, text="Browse…", command=self._pick_input).pack(side="left", padx=(6, 0))

        # --- Output file ---
        tk.Label(self, text="Output file", anchor="w").grid(row=2, column=0, sticky="w", pady=(0, 2))
        output_frame = tk.Frame(self)
        output_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(0, 16))

        self.output_var = tk.StringVar()
        tk.Entry(output_frame, textvariable=self.output_var, width=52).pack(side="left", fill="x", expand=True)
        tk.Button(output_frame, text="Browse…", command=self._pick_output).pack(side="left", padx=(6, 0))

        # --- Options ---
        options_frame = tk.LabelFrame(self, text="Options", padx=10, pady=8)
        options_frame.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(0, 16))
        options_frame.columnconfigure(1, weight=1)
        options_frame.columnconfigure(3, weight=1)

        # FPS
        tk.Label(options_frame, text="FPS").grid(row=0, column=0, sticky="w", padx=(0, 6))
        self.fps_var = tk.StringVar(value="15")
        fps_spin = tk.Spinbox(options_frame, from_=1, to=60, textvariable=self.fps_var, width=5)
        fps_spin.grid(row=0, column=1, sticky="w")

        # Width
        tk.Label(options_frame, text="Width (px)").grid(row=0, column=2, sticky="w", padx=(16, 6))
        self.width_var = tk.StringVar(value="480")
        width_spin = tk.Spinbox(options_frame, from_=64, to=3840, increment=16, textvariable=self.width_var, width=6)
        width_spin.grid(row=0, column=3, sticky="w")

        # Start / End time
        tk.Label(options_frame, text="Start (s)").grid(row=1, column=0, sticky="w", padx=(0, 6), pady=(6, 0))
        self.start_var = tk.StringVar(value="")
        tk.Entry(options_frame, textvariable=self.start_var, width=7).grid(row=1, column=1, sticky="w", pady=(6, 0))

        tk.Label(options_frame, text="Duration (s)").grid(row=1, column=2, sticky="w", padx=(16, 6), pady=(6, 0))
        self.dur_var = tk.StringVar(value="")
        tk.Entry(options_frame, textvariable=self.dur_var, width=7).grid(row=1, column=3, sticky="w", pady=(6, 0))

        # Dither
        tk.Label(options_frame, text="Dither").grid(row=2, column=0, sticky="w", padx=(0, 6), pady=(6, 0))
        self.dither_var = tk.StringVar(value="bayer")
        dither_menu = ttk.Combobox(
            options_frame,
            textvariable=self.dither_var,
            values=["bayer", "floyd_steinberg", "sierra2_4a", "none"],
            state="readonly",
            width=16,
        )
        dither_menu.grid(row=2, column=1, columnspan=3, sticky="w", pady=(6, 0))

        # Loop
        self.loop_var = tk.BooleanVar(value=True)
        tk.Checkbutton(options_frame, text="Loop forever", variable=self.loop_var).grid(
            row=3, column=0, columnspan=2, sticky="w", pady=(6, 0)
        )

        # --- Progress ---
        self.progress = ttk.Progressbar(self, mode="indeterminate", length=480)
        self.progress.grid(row=5, column=0, columnspan=2, sticky="ew", pady=(0, 8))

        self.status_var = tk.StringVar(value="Ready")
        tk.Label(self, textvariable=self.status_var, anchor="w", fg="#555555").grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(0, 12)
        )

        # --- Convert button ---
        self.convert_btn = tk.Button(
            self,
            text="Convert to GIF",
            command=self._start_conversion,
            bg="#2563eb",
            fg="white",
            activebackground="#1d4ed8",
            activeforeground="white",
            relief="flat",
            padx=16,
            pady=8,
            font=("", 12, "bold"),
        )
        self.convert_btn.grid(row=7, column=0, columnspan=2)

    def _pick_input(self):
        path = filedialog.askopenfilename(
            title="Select video file",
            filetypes=[("Video files", "*.mp4 *.mov *.MP4 *.MOV"), ("All files", "*.*")],
        )
        if path:
            self.input_var.set(path)

    def _pick_output(self):
        path = filedialog.asksaveasfilename(
            title="Save GIF as",
            defaultextension=".gif",
            filetypes=[("GIF image", "*.gif")],
        )
        if path:
            self.output_var.set(path)

    def _update_output_path(self):
        inp = self.input_var.get()
        if inp:
            base = os.path.splitext(inp)[0]
            self.output_var.set(base + ".gif")

    def _build_ffmpeg_cmd(self, input_path, output_path):
        fps = self.fps_var.get().strip() or "15"
        width = self.width_var.get().strip() or "480"
        dither = self.dither_var.get()
        loop = 0 if self.loop_var.get() else -1

        # Use palette for higher quality GIFs (two-pass)
        palette_path = output_path + ".palette.png"

        vf_gen = f"fps={fps},scale={width}:-1:flags=lanczos,palettegen"
        vf_use = f"fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither={dither}"

        pass1 = ["ffmpeg", "-y"]
        pass2 = ["ffmpeg", "-y"]

        start = self.start_var.get().strip()
        dur = self.dur_var.get().strip()

        if start:
            pass1 += ["-ss", start]
            pass2 += ["-ss", start]
        if dur:
            pass1 += ["-t", dur]
            pass2 += ["-t", dur]

        pass1 += ["-i", input_path, "-vf", vf_gen, palette_path]
        pass2 += ["-i", input_path, "-i", palette_path, "-filter_complex", vf_use, "-loop", str(loop), output_path]

        return pass1, pass2, palette_path

    def _start_conversion(self):
        input_path = self.input_var.get().strip()
        output_path = self.output_var.get().strip()

        if not input_path:
            messagebox.showerror("Error", "Please select an input file.")
            return
        if not os.path.isfile(input_path):
            messagebox.showerror("Error", f"Input file not found:\n{input_path}")
            return
        if not output_path:
            messagebox.showerror("Error", "Please specify an output file.")
            return

        self.convert_btn.config(state="disabled")
        self.progress.start(10)
        self.status_var.set("Generating palette…")

        thread = threading.Thread(target=self._run_conversion, args=(input_path, output_path), daemon=True)
        thread.start()

    def _run_conversion(self, input_path, output_path):
        try:
            pass1, pass2, palette_path = self._build_ffmpeg_cmd(input_path, output_path)

            # Pass 1 — palette
            result = subprocess.run(pass1, capture_output=True, text=True)
            if result.returncode != 0:
                self._finish(False, "Palette generation failed:\n" + result.stderr[-800:])
                return

            self.status_var.set("Encoding GIF…")

            # Pass 2 — encode
            result = subprocess.run(pass2, capture_output=True, text=True)

            # Clean up palette
            if os.path.exists(palette_path):
                os.remove(palette_path)

            if result.returncode != 0:
                self._finish(False, "GIF encoding failed:\n" + result.stderr[-800:])
                return

            size = os.path.getsize(output_path) / (1024 * 1024)
            self._finish(True, f"Done! Saved to {output_path} ({size:.1f} MB)")

        except Exception as e:
            self._finish(False, str(e))

    def _finish(self, success, message):
        self.after(0, self._finish_ui, success, message)

    def _finish_ui(self, success, message):
        self.progress.stop()
        self.convert_btn.config(state="normal")
        if success:
            self.status_var.set(message)
            messagebox.showinfo("Done", message)
        else:
            self.status_var.set("Error — see dialog")
            messagebox.showerror("Conversion failed", message)


if __name__ == "__main__":
    if not check_ffmpeg():
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("ffmpeg not found", "ffmpeg is not installed or not on PATH.\nInstall it with: brew install ffmpeg")
        raise SystemExit(1)

    app = GifConverter()
    app.mainloop()
