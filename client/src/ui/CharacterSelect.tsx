import { useState, useEffect, useRef, useCallback } from "react";
import "./CharacterSelect.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Gender   = "male" | "female";
export type SkinTone = 1 | 2 | 3 | 4;   // maps to 1.png … 4.png
export type EyeColor = "Black" | "Blue" | "Brown" | "Green";
export type ClothesColor = "Blue" | "Green" | "Pink" | "Purple" | "Red";
export type HairStyle = "Fawn" | "Iridessa" | "Josh" | "Lyria" | "Sebastian" | "Silvermist" | "Standart";
export type HairColor = "Black" | "Blonde" | "Brown" | "Ginger";

export interface CharacterSelectData {
  username:     string;
  gender:       Gender;
  skinTone:     SkinTone;
  eyeColor:     EyeColor;
  clothesColor: ClothesColor;
  hairStyle:    HairStyle;
  hairColor:    HairColor;
}

interface CharacterSelectProps {
  onConfirm: (data: CharacterSelectData) => void;
}

// ---------------------------------------------------------------------------
// Sprite Layout Constants
// ---------------------------------------------------------------------------
const CELL_W      = 64;
const CELL_H      = 64;
const ANIM_COLS   = 5;   // 5 frames of walking animation
const POSE_ROW    = 0;   // front-facing row
const SWATCH_COL  = 2;   // neutral front-facing column for swatches
const FRAME_DELAY = 180; // animation speed
const PREVIEW_SCALE = 5; // display scale (320x320)

const SKIN_TONES: SkinTone[] = [1, 2, 3, 4];
const EYE_COLORS: EyeColor[] = ["Black", "Blue", "Brown", "Green"];
const CLOTHES_COLORS: ClothesColor[] = ["Blue", "Green", "Pink", "Purple", "Red"];
const HAIR_STYLES: HairStyle[] = ["Standart", "Sebastian", "Josh", "Fawn", "Iridessa", "Lyria", "Silvermist"];
const HAIR_COLORS: HairColor[] = ["Black", "Blonde", "Brown", "Ginger"];

const SKIN_LABELS: Record<SkinTone, string> = {
  1: "Light",
  2: "Medium Light",
  3: "Medium",
  4: "Dark",
};

const EYE_COLOR_LABELS: Record<EyeColor, string> = {
  Black: "Black",
  Blue: "Blue",
  Brown: "Brown",
  Green: "Green",
};

const EYE_COLOR_HEX: Record<EyeColor, string> = {
  Black: "#1a1a1a",
  Blue: "#2563eb",
  Brown: "#784b28",
  Green: "#16a34a",
};

const CLOTHES_COLOR_LABELS: Record<ClothesColor, string> = {
  Blue: "Blue",
  Green: "Green",
  Pink: "Pink",
  Purple: "Purple",
  Red: "Red",
};

const CLOTHES_COLOR_HEX: Record<ClothesColor, string> = {
  Blue: "#2563eb",
  Green: "#16a34a",
  Pink: "#db2777",
  Purple: "#7c3aed",
  Red: "#dc2626",
};

const HAIR_COLOR_LABELS: Record<HairColor, string> = {
  Black: "Black",
  Blonde: "Blonde",
  Brown: "Brown",
  Ginger: "Ginger",
};

const HAIR_COLOR_HEX: Record<HairColor, string> = {
  Black: "#1a1a1a",
  Blonde: "#ebd078",
  Brown: "#784b28",
  Ginger: "#d15828",
};

// ---------------------------------------------------------------------------
// Helper: Draw layers to a canvas context
// ---------------------------------------------------------------------------
function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  bodyImg: HTMLImageElement | null,
  eyesImg: HTMLImageElement | null,
  clothesImg: HTMLImageElement | null,
  hairImg: HTMLImageElement | null,
  col: number,
  row: number,
  destW: number,
  destH: number,
) {
  ctx.clearRect(0, 0, destW, destH);
  ctx.imageSmoothingEnabled = false;

  const sx = col * CELL_W;
  const sy = row * CELL_H;

  // 1. Draw Body Layer
  if (bodyImg && bodyImg.complete && bodyImg.naturalWidth > 0) {
    ctx.drawImage(bodyImg, sx, sy, CELL_W, CELL_H, 0, 0, destW, destH);
  }

  // 2. Draw Eyes Layer
  if (eyesImg && eyesImg.complete && eyesImg.naturalWidth > 0) {
    ctx.drawImage(eyesImg, sx, sy, CELL_W, CELL_H, 0, 0, destW, destH);
  }

  // 3. Draw Clothes Layer
  if (clothesImg && clothesImg.complete && clothesImg.naturalWidth > 0) {
    ctx.drawImage(clothesImg, sx, sy, CELL_W, CELL_H, 0, 0, destW, destH);
  }

  // 4. Draw Hair Layer
  if (hairImg && hairImg.complete && hairImg.naturalWidth > 0) {
    ctx.drawImage(hairImg, sx, sy, CELL_W, CELL_H, 0, 0, destW, destH);
  }
}

// ---------------------------------------------------------------------------
// CharacterSelect Component
// ---------------------------------------------------------------------------
export function CharacterSelect({ onConfirm }: CharacterSelectProps) {
  const [step,          setStep        ] = useState<number>(1); // 1: Skin, 2: Eyes, 3: Hair, 4: Clothes & Name
  const [gender,        setGender      ] = useState<Gender>("male");
  const [skinTone,      setSkinTone    ] = useState<SkinTone>(1);
  const [eyeColor,      setEyeColor    ] = useState<EyeColor>("Black");
  const [clothesColor,  setClothesColor] = useState<ClothesColor>("Blue");
  const [hairStyle,     setHairStyle   ] = useState<HairStyle>("Standart");
  const [hairColor,     setHairColor   ] = useState<HairColor>("Black");
  const [username,      setUsername    ] = useState("");
  const [frame,         setFrame       ] = useState(0);
  const [error,         setError       ] = useState("");
  const [entering,      setEntering    ] = useState(false);


  const previewRef = useRef<HTMLCanvasElement>(null);
  const skinSwatchRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);
  const hairSwatchRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Cache of all HTMLImageElement objects
  const imageCache = useRef<{
    body: Record<Gender, Record<SkinTone, HTMLImageElement | null>>;
    eyes: Record<EyeColor, HTMLImageElement | null>;
    clothes: Record<Gender, Record<ClothesColor, HTMLImageElement | null>>;
    hair: Record<HairStyle, Record<HairColor, HTMLImageElement | null>>;
  }>({
    body: {
      male: { 1: null, 2: null, 3: null, 4: null },
      female: { 1: null, 2: null, 3: null, 4: null },
    },
    eyes: {
      Black: null,
      Blue: null,
      Brown: null,
      Green: null,
    },
    clothes: {
      male: { Blue: null, Green: null, Pink: null, Purple: null, Red: null },
      female: { Blue: null, Green: null, Pink: null, Purple: null, Red: null },
    },
    hair: {
      Fawn: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Iridessa: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Josh: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Lyria: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Sebastian: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Silvermist: { Black: null, Blonde: null, Brown: null, Ginger: null },
      Standart: { Black: null, Blonde: null, Brown: null, Ginger: null },
    },
  });

  // State to force re-render when images load
  const [, setImagesLoadedKey] = useState(0);

  // Helpers to retrieve or create images from cache
  const getBodyImage = useCallback((g: Gender, tone: SkinTone) => {
    const cached = imageCache.current.body[g][tone];
    if (cached) return cached;

    const img = new Image();
    img.src = `/assets/characters/${g}/${tone}.png`;
    img.onload = () => setImagesLoadedKey(prev => prev + 1);
    imageCache.current.body[g][tone] = img;
    return img;
  }, []);

  const getEyeImage = useCallback((color: EyeColor) => {
    const cached = imageCache.current.eyes[color];
    if (cached) return cached;

    const img = new Image();
    img.src = `/assets/eyes/${color}.png`;
    img.onload = () => setImagesLoadedKey(prev => prev + 1);
    imageCache.current.eyes[color] = img;
    return img;
  }, []);

  const getClothesImage = useCallback((g: Gender, color: ClothesColor) => {
    const cached = imageCache.current.clothes[g][color];
    if (cached) return cached;

    const img = new Image();
    img.src = `/assets/clothes/${g}/${color}.png`;
    img.onload = () => setImagesLoadedKey(prev => prev + 1);
    imageCache.current.clothes[g][color] = img;
    return img;
  }, []);

  const getHairImage = useCallback((style: HairStyle, color: HairColor) => {
    const cached = imageCache.current.hair[style][color];
    if (cached) return cached;

    const img = new Image();
    img.src = `/assets/hair/${style}/${color}.png`;
    img.onload = () => setImagesLoadedKey(prev => prev + 1);
    imageCache.current.hair[style][color] = img;
    return img;
  }, []);

  // ── Animation Loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % ANIM_COLS);
    }, FRAME_DELAY);
    return () => clearInterval(id);
  }, []);

  // ── Draw Main Preview Canvas ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bodyImg = getBodyImage(gender, skinTone);
    // Draw eyes if step >= 2
    const eyesImg = step >= 2 ? getEyeImage(eyeColor) : null;
    // Draw hair if step >= 3
    const hairImg = step >= 3 ? getHairImage(hairStyle, hairColor) : null;
    // Draw clothes if step >= 4
    const clothesImg = step >= 4 ? getClothesImage(gender, clothesColor) : null;

    drawCharacterFrame(
      ctx,
      bodyImg,
      eyesImg,
      clothesImg,
      hairImg,
      frame,
      POSE_ROW,
      CELL_W * PREVIEW_SCALE,
      CELL_H * PREVIEW_SCALE
    );
  }, [frame, gender, skinTone, eyeColor, clothesColor, hairStyle, hairColor, step, getBodyImage, getEyeImage, getClothesImage, getHairImage]);

  // ── Draw Skin Swatches ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 1) return;
    SKIN_TONES.forEach((tone, idx) => {
      const canvas = skinSwatchRefs.current[idx];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bodyImg = getBodyImage(gender, tone);
      drawCharacterFrame(ctx, bodyImg, null, null, null, SWATCH_COL, POSE_ROW, canvas.width, canvas.height);
    });
  }, [step, gender, getBodyImage]);

  // ── Draw Hair Swatches ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    HAIR_STYLES.forEach((style, idx) => {
      const canvas = hairSwatchRefs.current[idx];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bodyImg = getBodyImage(gender, skinTone);
      const eyesImg = getEyeImage(eyeColor);
      const hairImg = getHairImage(style, hairColor);

      // No clothes rendered in hair style selector swatches
      drawCharacterFrame(ctx, bodyImg, eyesImg, null, hairImg, SWATCH_COL, POSE_ROW, canvas.width, canvas.height);
    });
  }, [step, gender, skinTone, eyeColor, hairColor, getBodyImage, getEyeImage, getHairImage]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGenderSwitch = useCallback((g: Gender) => {
    setGender(g);
    setFrame(0);
  }, []);

  const handleConfirm = useCallback(() => {
    const name = username.trim();
    if (name.length < 3)  { setError("At least 3 characters required."); return; }
    if (name.length > 16) { setError("At most 16 characters allowed."); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) { setError("Only letters, numbers, and underscores allowed."); return; }
    setError("");
    setEntering(true);
    setTimeout(() => onConfirm({ username: name, gender, skinTone, eyeColor, clothesColor, hairStyle, hairColor }), 800);
  }, [username, gender, skinTone, eyeColor, clothesColor, hairStyle, hairColor, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && step === 4) handleConfirm();
    },
    [handleConfirm, step],
  );

  return (
    <div className={`cs-backdrop ${entering ? "cs-backdrop--exit" : ""}`}>
      {/* Floating particles */}
      <div className="cs-particles" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="cs-particle" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      <div className={`cs-panel ${entering ? "cs-panel--exit" : ""}`}>
        {/* Title */}
        <div className="cs-title">
          <span className="cs-title__icon">⚔</span>
          <span className="cs-title__text">CREATE CHARACTER</span>
        </div>

        {/* Gender pills */}
        <div className="cs-gender-pills">
          <button
            className={`cs-pill ${gender === "male" ? "cs-pill--active cs-pill--male" : ""}`}
            onClick={() => handleGenderSwitch("male")}
          >
            ♂ MALE
          </button>
          <button
            className={`cs-pill ${gender === "female" ? "cs-pill--active cs-pill--female" : ""}`}
            onClick={() => handleGenderSwitch("female")}
          >
            ♀ FEMALE
          </button>
        </div>

        <div className="cs-creator-workspace">
          {/* Left Side: Preview Area */}
          <div className="cs-preview-container">
            <div className="cs-preview-area">
              <div
                className="cs-preview-glow"
                style={{
                  "--glow-color": gender === "male" ? "96,165,250" : "244,114,182",
                } as React.CSSProperties}
              />
              <canvas
                ref={previewRef}
                width={CELL_W * PREVIEW_SCALE}
                height={CELL_H * PREVIEW_SCALE}
                className="cs-preview-canvas"
                aria-label="Character preview"
              />
              <div className="cs-preview-shadow" />
            </div>
          </div>

          {/* Right Side: Wizard Flow Section */}
          <div className="cs-customization-panel">
            {/* Step indicators */}
            <div className="cs-wizard-steps">
              <div className={`cs-wizard-step ${step === 1 ? "cs-wizard-step--active" : ""}`}>1. SKIN</div>
              <div className="cs-wizard-arrow">›</div>
              <div className={`cs-wizard-step ${step === 2 ? "cs-wizard-step--active" : ""}`}>2. EYES</div>
              <div className="cs-wizard-arrow">›</div>
              <div className={`cs-wizard-step ${step === 3 ? "cs-wizard-step--active" : ""}`}>3. HAIR</div>
              <div className="cs-wizard-arrow">›</div>
              <div className={`cs-wizard-step ${step === 4 ? "cs-wizard-step--active" : ""}`}>4. CLOTHES</div>
            </div>

            {/* Customization Options Content */}
            <div className="cs-customization-options">
              {/* Step 1: Skin Tone Selector */}
              {step === 1 && (
                <div className="cs-option-section">
                  <span className="cs-option-label">SELECT SKIN TONE</span>
                  <div className="cs-swatch-row">
                    {SKIN_TONES.map((tone, idx) => (
                      <button
                        key={tone}
                        className={`cs-swatch-card ${skinTone === tone ? "cs-swatch-card--selected" : ""}`}
                        onClick={() => setSkinTone(tone)}
                        title={SKIN_LABELS[tone]}
                        style={{
                          "--active-border": gender === "male" ? "#60a5fa" : "#f472b6",
                        } as React.CSSProperties}
                      >
                        <canvas
                          ref={(el) => { skinSwatchRefs.current[idx] = el; }}
                          width={CELL_W}
                          height={CELL_H}
                          className="cs-swatch-canvas"
                        />
                        {skinTone === tone && <span className="cs-swatch-check">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Eye Selector */}
              {step === 2 && (
                <div className="cs-option-section">
                  <span className="cs-option-label">SELECT EYE COLOR</span>
                  <div className="cs-color-row">
                    {EYE_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`cs-color-btn ${eyeColor === color ? "cs-color-btn--selected" : ""}`}
                        onClick={() => setEyeColor(color)}
                        title={EYE_COLOR_LABELS[color]}
                        style={{
                          "--color-hex": EYE_COLOR_HEX[color],
                          "--active-border": gender === "male" ? "#60a5fa" : "#f472b6",
                        } as React.CSSProperties}
                      >
                        <span className="cs-color-dot" style={{ backgroundColor: EYE_COLOR_HEX[color] }} />
                        <span className="cs-color-text">{EYE_COLOR_LABELS[color]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Hair Selector */}
              {step === 3 && (
                <>
                  {/* Hair Color Selector */}
                  <div className="cs-option-section">
                    <span className="cs-option-label">SELECT HAIR COLOR</span>
                    <div className="cs-color-row">
                      {HAIR_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`cs-color-btn ${hairColor === color ? "cs-color-btn--selected" : ""}`}
                          onClick={() => setHairColor(color)}
                          title={HAIR_COLOR_LABELS[color]}
                          style={{
                            "--color-hex": HAIR_COLOR_HEX[color],
                            "--active-border": gender === "male" ? "#60a5fa" : "#f472b6",
                          } as React.CSSProperties}
                        >
                          <span className="cs-color-dot" style={{ backgroundColor: HAIR_COLOR_HEX[color] }} />
                          <span className="cs-color-text">{HAIR_COLOR_LABELS[color]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hair Style Selector */}
                  <div className="cs-option-section" style={{ marginTop: "8px" }}>
                    <span className="cs-option-label">SELECT HAIR STYLE</span>
                    <div className="cs-hair-grid">
                      {HAIR_STYLES.map((style, idx) => (
                        <button
                          key={style}
                          className={`cs-swatch-card ${hairStyle === style ? "cs-swatch-card--selected" : ""}`}
                          onClick={() => setHairStyle(style)}
                          title={style}
                          style={{
                            "--active-border": gender === "male" ? "#60a5fa" : "#f472b6",
                          } as React.CSSProperties}
                        >
                          <canvas
                            ref={(el) => { hairSwatchRefs.current[idx] = el; }}
                            width={CELL_W}
                            height={CELL_H}
                            className="cs-swatch-canvas"
                          />
                          <div className="cs-style-name">{style}</div>
                          {hairStyle === style && <span className="cs-swatch-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Clothes & Name Selector */}
              {step === 4 && (
                <>
                  <div className="cs-option-section">
                    <span className="cs-option-label">SELECT CLOTHES COLOR</span>
                    <div className="cs-color-row">
                      {CLOTHES_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`cs-color-btn ${clothesColor === color ? "cs-color-btn--selected" : ""}`}
                          onClick={() => setClothesColor(color)}
                          title={CLOTHES_COLOR_LABELS[color]}
                          style={{
                            "--color-hex": CLOTHES_COLOR_HEX[color],
                            "--active-border": gender === "male" ? "#60a5fa" : "#f472b6",
                          } as React.CSSProperties}
                        >
                          <span className="cs-color-dot" style={{ backgroundColor: CLOTHES_COLOR_HEX[color] }} />
                          <span className="cs-color-text">{CLOTHES_COLOR_LABELS[color]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cs-input-group" style={{ marginTop: "16px" }}>
                    <label className="cs-label" htmlFor="cs-username">CHARACTER NAME</label>
                    <input
                      id="cs-username"
                      className={`cs-input ${error ? "cs-input--error" : ""}`}
                      type="text"
                      placeholder="Enter your name..."
                      value={username}
                      maxLength={16}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {error && <span className="cs-error">{error}</span>}
                    <span className="cs-char-count">{username.length}/16</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wizard Controls */}
        <div className="cs-wizard-controls">
          {step > 1 ? (
            <button className="cs-wizard-btn cs-wizard-btn--secondary" onClick={() => setStep(step - 1)}>
              ◀ BACK
            </button>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <button
            className={`cs-wizard-btn cs-wizard-btn--primary ${entering ? "cs-wizard-btn--entering" : ""}`}
            onClick={step === 4 ? handleConfirm : () => setStep(step + 1)}
            disabled={entering}
            id="cs-enter-button"
          >
            {step === 4 ? (
              entering ? "ENTERING WORLD..." : "ENTER THE WORLD ▶"
            ) : (
              "NEXT STEP ▶"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
