export const PROPOSAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&display=swap');
.qute{
  --cream:#fffbec; --gold:#f8cb1e; --gold-soft:#fdf0bf;
  --ink:#000; --ink2:#1a1a1a; --muted:#5a5a52; --line:#000;
  font-family:"Rubik",system-ui,sans-serif; color:var(--ink); line-height:1.5;
  -webkit-font-smoothing:antialiased;
  background-color:var(--cream);
  background-image:radial-gradient(circle, rgba(0,0,0,.06) 1px, transparent 1px);
  background-size:22px 22px;
  min-height:100vh;
}
.qute *{box-sizing:border-box; margin:0; padding:0}
.qute .wrap{max-width:1180px; margin:0 auto; padding:0 24px}
.qute .topbar{display:flex; align-items:center; justify-content:space-between; padding:22px 0}
.qute .brand{display:flex; align-items:center; gap:12px}
.qute .brand .mark{display:inline-grid; place-items:center; padding:5px; background:#fff;
  border:2px solid var(--ink); border-radius:18px; box-shadow:3px 3px 0 var(--ink)}
.qute .brand .logo{height:46px; width:auto; display:block; border-radius:12px}
.qute .tag{font-weight:700; font-size:14px; border:2px solid var(--ink); border-radius:999px;
  padding:7px 16px; background:#fff; box-shadow:2px 2px 0 var(--ink)}
.qute .hero{padding:46px 0 30px; display:flex; align-items:center; gap:48px}
.qute .hero-text{flex:1; min-width:0}
.qute .hero-img{flex:0 0 360px; max-width:40%}
.qute .hero-img img{width:100%; height:auto; display:block; filter:drop-shadow(8px 10px 0 rgba(0,0,0,.12))}
.qute .hero h1{font-size:clamp(34px,6vw,62px); font-weight:900; line-height:1.05; letter-spacing:-.01em}
.qute .hero h1 .hl{background:var(--gold); padding:0 10px; border:2px solid var(--ink); border-radius:14px;
  box-shadow:4px 4px 0 var(--ink); display:inline-block; transform:rotate(-1deg)}
.qute .hero p{font-size:clamp(17px,2.2vw,21px); color:var(--ink2); max-width:680px; margin-top:22px; font-weight:500}
.qute .hero p b{font-weight:800}
.qute .quote{margin-top:26px; max-width:440px; background:#fff; border:2px solid var(--ink);
  border-radius:16px; padding:16px 20px; box-shadow:4px 4px 0 var(--ink)}
.qute .quote-row{display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:6px 0}
.qute .quote-row + .quote-row{border-top:1.5px dashed #e0ddcf}
.qute .quote-k{font-size:14px; color:var(--muted); font-weight:600}
.qute .quote-client{font-size:19px; font-weight:800}
.qute .quote-price{font-size:24px; font-weight:900}
.qute .quote-price small{font-size:14px; font-weight:600; color:var(--muted)}
.qute .quote-price s{color:var(--muted); font-weight:600; font-size:18px; text-decoration-thickness:2px}
.qute .quote-price .zero{color:var(--ink)}
.qute .quote-note{margin-top:12px; padding-top:12px; border-top:2px solid var(--ink);
  font-size:13.5px; color:var(--ink2); font-weight:500; line-height:1.5; white-space:pre-line}
.qute .quote-note b{font-weight:800}
.qute section{padding:46px 0 8px}
.qute .sec-head{display:flex; align-items:center; gap:14px; margin-bottom:26px}
.qute .sec-head .kicker{font-size:13px; font-weight:800; letter-spacing:.14em; color:var(--muted)}
.qute .sec-head h2{font-size:30px; font-weight:900}
.qute .sec-head .rule{flex:1; height:3px; background:var(--ink); border-radius:3px}
.qute .showcase{margin:18px 0 8px}
.qute .showcase img{width:100%; height:auto; display:block}
.qute .grid{display:grid; grid-template-columns:repeat(3,1fr); gap:18px}
.qute .feat{position:relative; background:#fff; border:2px solid var(--ink); border-radius:18px;
  padding:22px; box-shadow:4px 4px 0 var(--ink); transition:transform .12s, box-shadow .12s}
.qute .feat:hover{transform:translate(-2px,-2px); box-shadow:6px 6px 0 var(--ink)}
.qute .feat .ico{width:48px; height:48px; border:2px solid var(--ink); border-radius:13px; background:var(--gold-soft);
  display:grid; place-items:center; margin-bottom:16px}
.qute .feat .ico svg{width:25px; height:25px}
.qute .feat h3{font-size:19px; font-weight:800; margin-bottom:8px}
.qute .feat p{font-size:15px; color:var(--ink2); font-weight:500; line-height:1.55}
.qute .new{position:absolute; top:18px; left:18px; font-size:12px; font-weight:800; color:var(--ink);
  background:var(--gold); border:2px solid var(--ink); border-radius:999px; padding:3px 10px; box-shadow:2px 2px 0 var(--ink)}
.qute .addon{display:inline-flex; align-items:center; gap:6px; margin-top:14px; font-size:13px; font-weight:700;
  color:var(--ink2); background:var(--gold-soft); border:2px solid var(--ink); border-radius:10px; padding:7px 12px}
.qute .cta{margin:56px 0 24px; background:var(--gold); border:2px solid var(--ink); border-radius:26px;
  padding:44px; box-shadow:6px 6px 0 var(--ink); text-align:center}
.qute .cta h2{font-size:clamp(26px,4vw,40px); font-weight:900; line-height:1.1}
.qute .cta p{font-size:18px; font-weight:600; margin-top:14px; color:var(--ink2)}
.qute .cta .btn{display:inline-block; margin-top:26px; background:var(--ink); color:var(--gold);
  font-weight:800; font-size:18px; padding:15px 38px; border-radius:14px; border:2px solid var(--ink);
  box-shadow:4px 4px 0 rgba(0,0,0,.25); text-decoration:none}
.qute .sign{margin:24px 0 56px; background:#fff; border:2px solid var(--ink); border-radius:26px;
  padding:36px; box-shadow:6px 6px 0 var(--ink)}
.qute .sign h2{font-size:clamp(22px,3.5vw,32px); font-weight:900; text-align:center}
.qute .sign .sub{text-align:center; color:var(--ink2); font-weight:500; margin-top:8px; font-size:16px}
.qute .sign .field{margin-top:22px}
.qute .sign label{display:block; font-weight:700; font-size:14px; margin-bottom:8px}
.qute .sign input[type=text]{width:100%; font-family:inherit; font-size:17px; font-weight:600;
  border:2px solid var(--ink); border-radius:12px; padding:12px 16px; background:var(--cream)}
.qute .sign .pad-wrap{position:relative; margin-top:8px}
.qute .sign canvas{width:100%; height:200px; display:block; background:var(--cream);
  border:2px solid var(--ink); border-radius:12px; touch-action:none; cursor:crosshair}
.qute .sign .pad-clear{position:absolute; top:10px; left:10px; font-size:12px; font-weight:700;
  background:#fff; border:2px solid var(--ink); border-radius:8px; padding:4px 10px; cursor:pointer; box-shadow:2px 2px 0 var(--ink)}
.qute .sign .pad-hint{position:absolute; inset:0; display:grid; place-items:center; pointer-events:none;
  color:var(--muted); font-weight:600; font-size:15px}
.qute .sign .submit{margin-top:22px; width:100%; background:var(--gold); color:var(--ink);
  font-family:inherit; font-weight:900; font-size:19px; padding:16px; border-radius:14px;
  border:2px solid var(--ink); box-shadow:4px 4px 0 var(--ink); cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:8px}
.qute .sign .submit:active{transform:translateY(2px); box-shadow:2px 2px 0 var(--ink)}
.qute .sign .submit:disabled{opacity:.55; cursor:not-allowed}
.qute .sign .err{margin-top:12px; color:#c2421f; font-weight:700; text-align:center; font-size:14px}
.qute .sign .done{text-align:center; padding:18px 0}
.qute .sign .done .big{font-size:clamp(24px,4vw,34px); font-weight:900}
.qute .sign .done .small{color:var(--ink2); font-weight:500; margin-top:8px; font-size:16px}
.qute footer{text-align:center; color:var(--muted); font-size:13px; padding-bottom:40px; font-weight:500}
.qute footer a{color:var(--ink); font-weight:700; text-decoration:none; border-bottom:2px solid var(--gold)}
@media (max-width:880px){
  .qute .grid{grid-template-columns:repeat(2,1fr)}
  .qute .hero{flex-direction:column-reverse; gap:28px}
  .qute .hero-img{flex:none; max-width:260px}
}
@media (max-width:560px){ .qute .grid{grid-template-columns:1fr} }
`;
