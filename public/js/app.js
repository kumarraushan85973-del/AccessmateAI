/* ============================================================
   AccessMate AI – Main Application Logic
   No .env setup needed — API key entered via Settings page.
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // ============ API KEY MANAGEMENT ============
  function getApiKey() {
    return localStorage.getItem("am-api-key") || "";
  }
  function setApiKey(key) {
    localStorage.setItem("am-api-key", key.trim());
  }
  function clearApiKey() {
    localStorage.removeItem("am-api-key");
  }

  // ============ UTILITIES ============
  function showToast(msg, type = "info") {
    const container = $("#toast-container");
    const icons = { success: "check_circle", error: "error", info: "info" };
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="material-icons-round">${icons[type]}</span><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 4000);
  }

  function showLoader(text = "Processing…") {
    $("#loader-text").textContent = text;
    $("#loader").classList.add("show");
  }
  function hideLoader() {
    $("#loader").classList.remove("show");
  }

  async function apiFetch(endpoint, body) {
    const key = getApiKey();
    if (!key) {
      showToast("API key not set. Go to Settings and enter your Gemini API key.", "error");
      navigateTo("settings");
      throw new Error("API key not configured");
    }
    body.apiKey = key;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => showToast("Copied to clipboard!", "success"),
      () => showToast("Failed to copy.", "error")
    );
  }

  // ============ NAVIGATION ============
  function navigateTo(pageId) {
    if (pageId === "voice-nav") { startVoiceNavigation(); return; }
    $$(".page").forEach(p => p.classList.remove("active"));
    const target = $(`#page-${pageId}`);
    if (target) target.classList.add("active");
    $$(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.page === pageId);
      b.setAttribute("aria-current", b.dataset.page === pageId ? "page" : "false");
    });
    $$(".mobile-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === pageId));
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$(".nav-btn").forEach(b => b.addEventListener("click", () => navigateTo(b.dataset.page)));
  $$(".mobile-nav-btn").forEach(b => b.addEventListener("click", () => navigateTo(b.dataset.page)));
  $$("[data-navigate]").forEach(el => el.addEventListener("click", () => navigateTo(el.dataset.navigate)));

  $("#mobile-menu-btn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("click", e => {
    const sb = $("#sidebar"), mb = $("#mobile-menu-btn");
    if (sb.classList.contains("open") && !sb.contains(e.target) && !mb.contains(e.target)) sb.classList.remove("open");
  });

  // ============ THEME ============
  const themeToggle = $("#theme-toggle");
  document.documentElement.setAttribute("data-theme", localStorage.getItem("am-theme") || "light");
  updateThemeIcon();
  themeToggle.addEventListener("click", toggleTheme);
  if ($("#pref-theme")) $("#pref-theme").addEventListener("click", toggleTheme);

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("am-theme", next);
    updateThemeIcon();
    showToast(`${next === "dark" ? "Dark" : "Light"} mode activated`, "info");
  }
  function updateThemeIcon() {
    themeToggle.querySelector(".material-icons-round").textContent =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light_mode" : "dark_mode";
  }

  // ============ FONT SIZE ============
  const fontSizes = ["normal", "large", "xlarge"];
  let fontIdx = Math.max(0, fontSizes.indexOf(localStorage.getItem("am-fontsize") || "normal"));
  document.documentElement.setAttribute("data-fontsize", fontSizes[fontIdx]);

  function cycleFont() {
    fontIdx = (fontIdx + 1) % fontSizes.length;
    document.documentElement.setAttribute("data-fontsize", fontSizes[fontIdx]);
    localStorage.setItem("am-fontsize", fontSizes[fontIdx]);
    showToast(`Font size: ${["Normal", "Large", "Extra Large"][fontIdx]}`, "info");
  }
  $("#font-size-btn").addEventListener("click", cycleFont);
  if ($("#pref-font")) $("#pref-font").addEventListener("click", cycleFont);

  // ============ SETTINGS — API KEY UI ============
  const keyInput = $("#api-key-input");
  const keyStatus = $("#key-status");

  // Load saved key into input
  if (getApiKey()) keyInput.value = getApiKey();

  // Show / Hide key
  $("#btn-toggle-key").addEventListener("click", () => {
    const isHidden = keyInput.type === "password";
    keyInput.type = isHidden ? "text" : "password";
    $("#btn-toggle-key").querySelector(".material-icons-round").textContent = isHidden ? "visibility_off" : "visibility";
  });

  // Save key
  $("#btn-save-key").addEventListener("click", () => {
    const key = keyInput.value.trim();
    if (!key) {
      showKeyStatus("Please paste your API key first.", "error");
      return;
    }
    setApiKey(key);
    showKeyStatus("✅ API key saved! All AI features are now ready.", "success");
    showToast("API key saved successfully!", "success");
    updateDashboardBanner();
  });

  // Test key
  $("#btn-test-key").addEventListener("click", async () => {
    const key = keyInput.value.trim();
    if (!key) { showKeyStatus("Enter a key first.", "error"); return; }
    showKeyStatus("⏳ Testing key…", "info");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", sourceLang: "English", targetLang: "Hindi", apiKey: key }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setApiKey(key);
        showKeyStatus(`✅ Key works! Test translation: "${data.result}"`, "success");
        updateDashboardBanner();
      } else {
        showKeyStatus("❌ Key failed: " + (data.error || "Invalid response"), "error");
      }
    } catch (err) {
      showKeyStatus("❌ Test failed: " + err.message, "error");
    }
  });

  // Clear key
  $("#btn-clear-key").addEventListener("click", () => {
    clearApiKey();
    keyInput.value = "";
    showKeyStatus("API key removed.", "info");
    updateDashboardBanner();
  });

  function showKeyStatus(msg, type) {
    keyStatus.textContent = msg;
    keyStatus.className = `key-status show ${type}`;
  }

  // Dashboard API banner
  function updateDashboardBanner() {
    const banner = $("#api-status-banner");
    const text = $("#api-status-text");
    banner.className = "api-status-banner";
    if (getApiKey()) {
      banner.classList.add("connected");
      text.textContent = "✅ Gemini API key configured — All AI features are ready!";
    } else {
      banner.classList.add("error");
      text.innerHTML = '⚠️ API key not set. <a href="#" onclick="document.querySelector(\'[data-page=settings]\').click();return false;" style="color:inherit;text-decoration:underline;font-weight:600;">Go to Settings</a> to enter your Gemini API key.';
    }
  }
  updateDashboardBanner();

  // ============ 1. CAMERA AI ============
  let cameraStream = null;
  let useFrontCamera = true; // true = webcam (user), false = rear/phone (environment)
  const btnStartCam = $("#btn-start-camera"), btnCapture = $("#btn-capture");
  const btnReadText = $("#btn-read-text"), btnStopCam = $("#btn-stop-camera");
  const btnFlipCam = $("#btn-flip-camera");
  const video = $("#camera-video"), canvas = $("#camera-canvas"), placeholder = $("#camera-placeholder");

  async function startCamera() {
    // Stop any existing stream first
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    try {
      // Use simple "true" on first try to pick the default system webcam.
      // Only use facingMode when user explicitly flips to rear camera.
      const constraints = useFrontCamera
        ? { video: { width: { ideal: 1280 }, height: { ideal: 960 } } }
        : { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } } };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;
      placeholder.style.display = "none";
      btnCapture.disabled = false; btnReadText.disabled = false;
      btnStopCam.disabled = false; btnStartCam.disabled = true;
      if (btnFlipCam) btnFlipCam.disabled = false;
      showToast("Camera started!", "success");
    } catch (err) {
      showToast("Camera access denied: " + err.message, "error");
    }
  }

  btnStartCam.addEventListener("click", () => {
    useFrontCamera = true; // Always start with default webcam
    startCamera();
  });

  // Flip camera button
  if (btnFlipCam) {
    btnFlipCam.addEventListener("click", () => {
      useFrontCamera = !useFrontCamera;
      showToast(useFrontCamera ? "Switched to front camera (webcam)" : "Switched to rear camera", "info");
      startCamera();
    });
  }

  btnStopCam.addEventListener("click", () => {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    video.srcObject = null;
    placeholder.style.display = "flex";
    btnCapture.disabled = true; btnReadText.disabled = true;
    btnStopCam.disabled = true; btnStartCam.disabled = false;
    if (btnFlipCam) btnFlipCam.disabled = true;
  });

  async function captureAndAnalyze(mode) {
    if (!cameraStream) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    showLoader(mode === "read-text" ? "Reading text from image…" : "Identifying objects…");
    try {
      const { result } = await apiFetch("/api/analyze-image", { image: dataUrl, mode });
      $("#camera-result-text").textContent = result;
      hideLoader();
      showToast("Analysis complete!", "success");
      speakText(result);
    } catch (err) {
      hideLoader();
      if (err.message !== "API key not configured")
        $("#camera-result-text").textContent = "Error: " + err.message;
    }
  }
  btnCapture.addEventListener("click", () => captureAndAnalyze("identify"));
  btnReadText.addEventListener("click", () => captureAndAnalyze("read-text"));

  // ============ 2. SPEECH TO TEXT ============
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let sttRec = null, sttTranscript = "";
  const btnSttStart = $("#btn-stt-start"), btnSttStop = $("#btn-stt-stop");
  const sttOutput = $("#stt-output"), sttStatus = $("#stt-status");

  if (SpeechRecognition) {
    sttRec = new SpeechRecognition();
    sttRec.continuous = true;
    sttRec.interimResults = true;
    sttRec.onstart = () => {
      sttStatus.classList.add("listening");
      sttStatus.innerHTML = '<span class="status-dot"></span> Listening…';
      btnSttStart.disabled = true; btnSttStop.disabled = false;
    };
    sttRec.onend = () => {
      sttStatus.classList.remove("listening");
      sttStatus.innerHTML = '<span class="status-dot"></span> Stopped';
      btnSttStart.disabled = false; btnSttStop.disabled = true;
    };
    sttRec.onerror = e => { showToast("Speech error: " + e.error, "error"); sttRec.stop(); };
    sttRec.onresult = e => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (final) sttTranscript += final;
      sttOutput.innerHTML = "";
      sttOutput.textContent = sttTranscript + interim;
    };
  }
  btnSttStart.addEventListener("click", () => {
    if (!SpeechRecognition) { showToast("Not supported. Use Chrome or Edge.", "error"); return; }
    sttRec.lang = $("#stt-lang").value;
    sttTranscript = "";
    sttOutput.innerHTML = "";
    sttRec.start();
  });
  btnSttStop.addEventListener("click", () => { if (sttRec) sttRec.stop(); });
  $("#btn-stt-copy").addEventListener("click", () => copyToClipboard(sttOutput.textContent));
  $("#btn-stt-clear").addEventListener("click", () => {
    sttTranscript = "";
    sttOutput.innerHTML = '<span class="placeholder-text">Your transcribed text will appear here…</span>';
  });

  // ============ 3. TEXT TO SPEECH ============
  const ttsInput = $("#tts-input"), ttsVoice = $("#tts-voice");
  const ttsRate = $("#tts-rate"), ttsPitch = $("#tts-pitch");

  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    ttsVoice.innerHTML = "";
    if (!voices.length) { ttsVoice.innerHTML = '<option value="">No voices</option>'; return; }
    voices.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = `${v.name} (${v.lang})${v.default ? " ★" : ""}`;
      ttsVoice.appendChild(o);
    });
  }
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  ttsRate.addEventListener("input", () => $("#tts-rate-val").textContent = Number(ttsRate.value).toFixed(1) + "×");
  ttsPitch.addEventListener("input", () => $("#tts-pitch-val").textContent = Number(ttsPitch.value).toFixed(1));
  ttsInput.addEventListener("input", () => $("#tts-char-count").textContent = ttsInput.value.length);

  $("#btn-tts-speak").addEventListener("click", () => {
    const text = ttsInput.value.trim();
    if (!text) { showToast("Enter text first.", "error"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    if (voices[ttsVoice.value]) u.voice = voices[ttsVoice.value];
    u.rate = parseFloat(ttsRate.value);
    u.pitch = parseFloat(ttsPitch.value);
    u.onstart = () => { $("#tts-progress-text").textContent = "Speaking…"; $("#btn-tts-pause").disabled = false; $("#btn-tts-stop").disabled = false; };
    u.onend = () => {
      $("#tts-progress-text").textContent = "Done";
      $("#tts-progress-fill").style.width = "100%";
      $("#btn-tts-pause").disabled = true; $("#btn-tts-stop").disabled = true;
      setTimeout(() => { $("#tts-progress-fill").style.width = "0%"; $("#tts-progress-text").textContent = "Ready"; }, 2000);
    };
    u.onboundary = e => {
      if (e.charIndex !== undefined)
        $("#tts-progress-fill").style.width = Math.min(100, (e.charIndex / text.length) * 100) + "%";
    };
    speechSynthesis.speak(u);
  });

  $("#btn-tts-pause").addEventListener("click", () => {
    if (speechSynthesis.paused) { speechSynthesis.resume(); $("#btn-tts-pause").innerHTML = '<span class="material-icons-round">pause</span> Pause'; }
    else { speechSynthesis.pause(); $("#btn-tts-pause").innerHTML = '<span class="material-icons-round">play_arrow</span> Resume'; }
  });
  $("#btn-tts-stop").addEventListener("click", () => {
    speechSynthesis.cancel();
    $("#tts-progress-text").textContent = "Stopped";
    $("#tts-progress-fill").style.width = "0%";
    $("#btn-tts-pause").disabled = true; $("#btn-tts-stop").disabled = true;
  });

  // ============ 4. SUMMARIZER ============
  const sumInput = $("#summarizer-input");
  sumInput.addEventListener("input", () => $("#sum-char-count").textContent = sumInput.value.length);

  $("#btn-summarize").addEventListener("click", async () => {
    const text = sumInput.value.trim();
    if (!text) { showToast("Paste some text to summarize.", "error"); return; }
    if (text.length < 50) { showToast("Text too short. Paste a longer document.", "error"); return; }
    showLoader("Generating AI summary…");
    try {
      const { result } = await apiFetch("/api/summarize", { text, language: $("#sum-lang").value });
      $("#summarizer-result-text").textContent = result;
      hideLoader();
      showToast("Summary generated!", "success");
    } catch (err) {
      hideLoader();
      if (err.message !== "API key not configured")
        $("#summarizer-result-text").textContent = "Error: " + err.message;
    }
  });
  $("#btn-sum-copy").addEventListener("click", () => copyToClipboard($("#summarizer-result-text").textContent));

  // ============ 5. TRANSLATOR ============
  const transInput = $("#trans-input");

  $("#btn-translate").addEventListener("click", async () => {
    const text = transInput.value.trim();
    if (!text) { showToast("Enter text to translate.", "error"); return; }
    showLoader("Translating…");
    try {
      const { result } = await apiFetch("/api/translate", {
        text, sourceLang: $("#trans-source-lang").value, targetLang: $("#trans-target-lang").value,
      });
      $("#trans-output").textContent = result;
      hideLoader();
      showToast("Translation complete!", "success");
    } catch (err) {
      hideLoader();
      if (err.message !== "API key not configured")
        $("#trans-output").textContent = "Error: " + err.message;
    }
  });

  $("#btn-swap-lang").addEventListener("click", () => {
    const src = $("#trans-source-lang"), tgt = $("#trans-target-lang");
    if (src.value === "Auto-detect") { showToast("Cannot swap Auto Detect.", "info"); return; }
    const sv = src.value, tv = tgt.value;
    src.value = tv; tgt.value = sv;
    const st = transInput.value, tt = $("#trans-output").textContent;
    if (tt && tt !== "Translation will appear here…") { transInput.value = tt; $("#trans-output").textContent = st; }
  });
  $("#btn-trans-copy").addEventListener("click", () => copyToClipboard($("#trans-output").textContent));

  // ============ 6. VOICE NAVIGATION ============
  function startVoiceNavigation() {
    if (!SpeechRecognition) { showToast("Not supported. Use Chrome or Edge.", "error"); return; }
    const overlay = $("#voice-overlay"), text = $("#voice-overlay-text");
    overlay.classList.add("show");
    const rec = new SpeechRecognition();
    rec.lang = "en-IN"; rec.interimResults = false;
    rec.onresult = async e => {
      const cmd = e.results[0][0].transcript;
      text.textContent = `You said: "${cmd}"`;
      try {
        const { result } = await apiFetch("/api/voice-command", { command: cmd });
        if (result.spoken_response) speakText(result.spoken_response);
        if (result.action === "navigate" && result.target) setTimeout(() => navigateTo(result.target), 1500);
        setTimeout(() => overlay.classList.remove("show"), 2500);
      } catch {
        text.textContent = "Sorry, I didn't understand. Try again.";
        speakText("Sorry, I didn't understand.");
        setTimeout(() => overlay.classList.remove("show"), 3000);
      }
    };
    rec.onerror = () => { text.textContent = "Could not hear you."; setTimeout(() => overlay.classList.remove("show"), 2000); };
    rec.onend = () => setTimeout(() => { if (overlay.classList.contains("show")) overlay.classList.remove("show"); }, 5000);
    rec.start();
    text.textContent = "Listening… Say a command.";
  }

  $("#voice-nav-btn").addEventListener("click", startVoiceNavigation);
  $("#mobile-voice-btn").addEventListener("click", startVoiceNavigation);

  // ============ SHARED SPEAK ============
  function speakText(text) {
    if (!text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    const voices = speechSynthesis.getVoices();
    const ev = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google"));
    if (ev) u.voice = ev;
    speechSynthesis.speak(u);
  }

  $$(".speak-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = document.getElementById(btn.dataset.target);
      if (t) speakText(t.textContent);
    });
  });

  // ============ KEYBOARD SHORTCUTS ============
  document.addEventListener("keydown", e => {
    if (e.altKey && e.key === "v") { e.preventDefault(); startVoiceNavigation(); }
    const nav = { "1": "dashboard", "2": "camera", "3": "stt", "4": "tts", "5": "summarizer", "6": "translator", "7": "settings" };
    if (e.altKey && nav[e.key]) { e.preventDefault(); navigateTo(nav[e.key]); }
    if (e.key === "Escape") { $("#voice-overlay").classList.remove("show"); $("#sidebar").classList.remove("open"); }
  });

  console.log("🚀 AccessMate AI initialized.");
})();
