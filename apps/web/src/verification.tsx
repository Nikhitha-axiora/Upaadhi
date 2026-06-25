/* ============================================================================
   Upaadhi — Identity verification (KYC)
   A calm, reassuring multi-step flow: explain why → ID details → ID photo →
   selfie-with-ID (live camera) → review & consent → submitted for review.
   Images are downscaled in-browser before upload and stored server-side.
   ========================================================================== */
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock,
  IdCard,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  idTypeLabels,
  maskIdNumber,
  type IdType,
  type VerificationRecord,
  type VerificationSubmission
} from "@upaadhi/shared";
import { Modal } from "./ui";

const idTypeList: IdType[] = ["aadhaar", "pan", "driving_license", "voter_id", "passport"];

/** Load a file/data URL into an image, downscale, and re-encode as JPEG. */
export async function downscaleToDataUrl(source: File | string, maxDim = 1280, quality = 0.72): Promise<string> {
  const src = typeof source === "string" ? source : await readFileAsDataUrl(source);
  const image = await loadImage(src);
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}

/* ---- Live camera capture ------------------------------------------------- */

function CameraCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 } },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Camera unavailable. You can upload a selfie instead.");
      }
    }
    void start();
    return () => {
      active = false;
      stop();
    };
  }, [stop]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const maxDim = 960;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stop();
    onCapture(canvas.toDataURL("image/jpeg", 0.72));
  }

  if (error) {
    return (
      <div className="kyc-camera-fallback">
        <p>{error}</p>
        <FilePicker label="Upload selfie with ID" onPick={(url) => onCapture(url)} />
      </div>
    );
  }

  return (
    <div className="kyc-camera">
      <div className="kyc-camera-frame">
        <video ref={videoRef} playsInline muted />
        <div className="kyc-camera-guide" aria-hidden="true">
          <span className="kyc-guide-face" />
          <span className="kyc-guide-id">Hold ID here</span>
        </div>
      </div>
      <button className="primary-button full" type="button" disabled={!ready} onClick={capture}>
        <Camera size={18} /> {ready ? "Capture selfie" : "Starting camera…"}
      </button>
    </div>
  );
}

/* ---- File picker --------------------------------------------------------- */

function FilePicker({ label, onPick }: { label: string; onPick: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            onPick(await downscaleToDataUrl(file));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button className="secondary-button full" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
        {label}
      </button>
    </>
  );
}

/* ---- Verification modal -------------------------------------------------- */

const steps = ["About", "ID details", "ID photo", "Selfie", "Review"];

export function VerificationModal({
  open,
  onClose,
  kyc,
  busy,
  onSubmit,
  onApproveDemo
}: {
  open: boolean;
  onClose: () => void;
  kyc: VerificationRecord | null;
  busy: boolean;
  onSubmit: (payload: VerificationSubmission) => Promise<void>;
  onApproveDemo: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState<IdType>("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [idName, setIdName] = useState("");
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const status = kyc?.kycStatus ?? "unverified";
  const inProgress = status === "under_review" || status === "verified";

  useEffect(() => {
    if (open && !inProgress) setStep(0);
  }, [open, inProgress]);

  function reset() {
    setStep(0);
    setIdNumber("");
    setIdName("");
    setIdImage(null);
    setSelfie(null);
    setConsent(false);
  }

  async function submit() {
    if (!idImage || !selfie) return;
    await onSubmit({ idType, idNumber, idName, idImage, selfieImage: selfie });
    reset();
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="kyc-title">
      <div className="kyc">
        <header className="kyc-head">
          <div className="kyc-head-title">
            <ShieldCheck size={20} />
            <strong id="kyc-title">Verify your identity</strong>
          </div>
          <button className="kyc-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {inProgress ? (
          <StatusScreen kyc={kyc} busy={busy} onApproveDemo={onApproveDemo} onClose={onClose} />
        ) : (
          <>
            <Stepper step={step} />
            <div className="kyc-body">
              {step === 0 ? <IntroStep /> : null}

              {step === 1 ? (
                <div className="kyc-form">
                  <label>
                    Government ID type
                    <div className="kyc-id-types">
                      {idTypeList.map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={idType === type ? "type-chip active" : "type-chip"}
                          onClick={() => setIdType(type)}
                        >
                          {idTypeLabels[type]}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label>
                    ID number
                    <input
                      value={idNumber}
                      onChange={(event) => setIdNumber(event.target.value)}
                      placeholder={`Your ${idTypeLabels[idType]} number`}
                      autoComplete="off"
                    />
                    {idNumber.trim().length >= 4 ? (
                      <span className="kyc-hint">Stored as {maskIdNumber(idNumber)} · only reviewers can see the full number.</span>
                    ) : null}
                  </label>
                  <label>
                    Name as printed on ID
                    <input value={idName} onChange={(event) => setIdName(event.target.value)} placeholder="Full name" />
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="kyc-upload">
                  <p className="kyc-lead">Upload a clear photo of your {idTypeLabels[idType]}. Make sure the name, photo and number are readable.</p>
                  {idImage ? (
                    <div className="kyc-preview">
                      <img src={idImage} alt="Government ID preview" />
                      <button className="secondary-button" type="button" onClick={() => setIdImage(null)}>
                        <RefreshCw size={16} /> Replace
                      </button>
                    </div>
                  ) : (
                    <div className="kyc-dropzone">
                      <IdCard size={30} />
                      <FilePicker label="Choose ID photo" onPick={setIdImage} />
                    </div>
                  )}
                  <p className="kyc-privacy">
                    <Lock size={13} /> Encrypted in transit. Used only to confirm it's really you.
                  </p>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="kyc-upload">
                  <p className="kyc-lead">Take a selfie while holding your ID next to your face. This proves the ID belongs to you.</p>
                  {selfie ? (
                    <div className="kyc-preview">
                      <img src={selfie} alt="Selfie preview" />
                      <button className="secondary-button" type="button" onClick={() => setSelfie(null)}>
                        <RefreshCw size={16} /> Retake
                      </button>
                    </div>
                  ) : (
                    <CameraCapture onCapture={setSelfie} />
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="kyc-review">
                  <div className="kyc-review-grid">
                    <div>
                      <span>ID type</span>
                      <strong>{idTypeLabels[idType]}</strong>
                    </div>
                    <div>
                      <span>ID number</span>
                      <strong>{maskIdNumber(idNumber)}</strong>
                    </div>
                    <div>
                      <span>Name on ID</span>
                      <strong>{idName}</strong>
                    </div>
                  </div>
                  <div className="kyc-review-thumbs">
                    {idImage ? <img src={idImage} alt="ID" /> : null}
                    {selfie ? <img src={selfie} alt="Selfie" /> : null}
                  </div>
                  <label className="kyc-consent">
                    <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                    <span>
                      I confirm these details are correct and I consent to Upaadhi verifying my identity to keep the community safe.
                    </span>
                  </label>
                </div>
              ) : null}
            </div>

            <footer className="kyc-foot">
              {step > 0 ? (
                <button className="secondary-button" type="button" onClick={() => setStep((value) => value - 1)} disabled={busy}>
                  <ChevronLeft size={16} /> Back
                </button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={!canAdvance(step, { idNumber, idName, idImage, selfie })}
                  onClick={() => setStep((value) => value + 1)}
                >
                  Continue
                </button>
              ) : (
                <button className="primary-button" type="button" disabled={!consent || busy} onClick={() => void submit()}>
                  {busy ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
                  Submit for review
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </Modal>
  );
}

function canAdvance(
  step: number,
  data: { idNumber: string; idName: string; idImage: string | null; selfie: string | null }
) {
  if (step === 1) return data.idNumber.trim().length >= 4 && data.idName.trim().length >= 2;
  if (step === 2) return Boolean(data.idImage);
  if (step === 3) return Boolean(data.selfie);
  return true;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="kyc-stepper">
      {steps.map((label, index) => (
        <div key={label} className={`kyc-step${index === step ? " active" : ""}${index < step ? " done" : ""}`}>
          <span className="kyc-step-dot">{index < step ? <CheckCircle2 size={14} /> : index + 1}</span>
          <span className="kyc-step-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

function IntroStep() {
  return (
    <div className="kyc-intro">
      <div className="kyc-intro-badge">
        <ShieldCheck size={30} />
      </div>
      <h3>A safer marketplace starts with trust</h3>
      <p>
        We verify everyone once so you always know who you're talking to. It takes about a minute and you'll only do it
        once.
      </p>
      <ul className="kyc-points">
        <li>
          <BadgeCheck size={18} /> Unlocks calling and chatting with posters
        </li>
        <li>
          <Lock size={18} /> Your documents are private — never shown on your profile
        </li>
        <li>
          <CheckCircle2 size={18} /> Only our verification reviewers can see them
        </li>
      </ul>
    </div>
  );
}

function StatusScreen({
  kyc,
  busy,
  onApproveDemo,
  onClose
}: {
  kyc: VerificationRecord | null;
  busy: boolean;
  onApproveDemo: () => Promise<void>;
  onClose: () => void;
}) {
  const verified = kyc?.kycStatus === "verified";
  return (
    <div className="kyc-status">
      <div className={verified ? "kyc-status-badge verified" : "kyc-status-badge review"}>
        {verified ? <BadgeCheck size={34} /> : <Clock size={34} />}
      </div>
      <h3>{verified ? "You're verified" : "Submitted for review"}</h3>
      <p>
        {verified
          ? "Your identity is confirmed. You can now call and chat with anyone on Upaadhi."
          : "Thanks! Our team is reviewing your documents. This usually takes a few minutes. We'll unlock calling and chat as soon as you're approved."}
      </p>
      {kyc?.idType ? (
        <div className="kyc-status-meta">
          <span>
            {idTypeLabels[kyc.idType]} · {kyc.idNumberMasked}
          </span>
          {kyc.ipAddress ? <span>Submitted from {kyc.ipAddress}</span> : null}
        </div>
      ) : null}
      {verified ? (
        <button className="primary-button full" type="button" onClick={onClose}>
          Done
        </button>
      ) : (
        <>
          <button className="primary-button full" type="button" disabled={busy} onClick={() => void onApproveDemo()}>
            {busy ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
            Approve now (demo reviewer)
          </button>
          <p className="kyc-demo-note">Demo only — simulates a reviewer approving your documents.</p>
        </>
      )}
    </div>
  );
}
