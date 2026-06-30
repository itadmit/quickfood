"use client";

import { useEffect, useRef, useState } from "react";

export function ProposalSign({
  token,
  alreadySigned,
  signerName,
}: {
  token: string;
  alreadySigned: boolean;
  signerName: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [name, setName] = useState("");
  const [hint, setHint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(alreadySigned);
  const [doneName, setDoneName] = useState(signerName ?? "");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (done) return;
    drawing.current = true;
    setHint(false);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  }
  function end() {
    drawing.current = false;
  }
  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setHint(true);
  }

  async function submit() {
    setErr("");
    if (name.trim().length < 2) {
      setErr("נא למלא שם מלא לחתימה");
      return;
    }
    if (!hasInk.current) {
      setErr("נא לחתום במשטח החתימה");
      return;
    }
    setBusy(true);
    try {
      const signatureData = canvasRef.current!.toDataURL("image/png");
      const res = await fetch(`/api/v1/qute/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: name.trim(), signatureData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error?.message || "שליחה נכשלה, נסו שוב");
        setBusy(false);
        return;
      }
      setDoneName(name.trim());
      setDone(true);
    } catch {
      setErr("שגיאת רשת, נסו שוב");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="sign">
        <div className="done">
          <div className="big">ההצעה אושרה ונחתמה 🎉</div>
          <div className="small">
            תודה{doneName ? `, ${doneName}` : ""}! קיבלנו את החתימה וניצור איתך קשר בהקדם.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sign">
      <h2>מאשרים את ההצעה?</h2>
      <div className="sub">מלאו שם, חתמו במשטח ושלחו - וזהו, התחלנו.</div>

      <div className="field">
        <label htmlFor="signer">שם מלא</label>
        <input
          id="signer"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="השם שלך"
          autoComplete="name"
        />
      </div>

      <div className="field">
        <label>חתימה</label>
        <div className="pad-wrap">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {hint && <div className="pad-hint">חתמו כאן באצבע או בעכבר</div>}
          <button type="button" className="pad-clear" onClick={clear}>נקה</button>
        </div>
      </div>

      <button type="button" className="submit" onClick={submit} disabled={busy}>
        {busy ? "שולח..." : "אישור ושליחה"}
      </button>
      {err && <div className="err">{err}</div>}
    </div>
  );
}
