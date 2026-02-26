import { BrowserWindow, app, desktopCapturer, ipcMain, session, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Store from "electron-store";
import { v4 } from "uuid";
import { Ollama } from "ollama";
/**
* Audio IPC — main process side.
*
* Responsibilities:
*  1. Configure setDisplayMediaRequestHandler so Windows loopback audio
*     (system sound) is captured in the renderer WITHOUT a pick-a-window dialog.
*  2. Expose desktopCapturer source list to renderer (optional helper).
*
* Actual audio capture (Web Audio API, AudioWorklet) runs entirely in the
* renderer process.  The main process is only needed for the loopback trick
* on Windows.
*/
function setupAudioIPC() {
	session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
		desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
			if (sources.length > 0) callback({
				video: sources[0],
				audio: "loopback"
			});
			else callback({});
		}).catch(() => callback({}));
	}, { useSystemPicker: false });
	ipcMain.handle("audio:get-sources", async () => {
		return (await desktopCapturer.getSources({
			types: ["screen", "window"],
			thumbnailSize: {
				width: 0,
				height: 0
			}
		})).map((s) => ({
			id: s.id,
			name: s.name
		}));
	});
}
var QUERY_PATTERNS = [
	/[¿?]?\s*cómo\s+(se\s+)?(hace|funciona|implementa|usa|instala|configura|despliega)/i,
	/[¿?]?\s*qué\s+(es|son|hace|significa|ventaja|diferencia)/i,
	/[¿?]?\s*cuál\s+(es|son|sería|debería)/i,
	/[¿?]?\s*cuándo\s+(usar|se\s+usa|conviene|debo)/i,
	/\bvs\.?\s+\b|\bversus\b/i,
	/diferencia\s+(entre|de|con)/i,
	/mejor\s+(opción|alternativa|práctica|herramienta)/i,
	/[¿?]?\s*how\s+(does|do|to|is|are|would)/i,
	/[¿?]?\s*what\s+(is|are|does|difference)/i,
	/[¿?]?\s*which\s+(is|are|one|should)/i,
	/[¿?]?\s*when\s+(to\s+use|should|do\s+i)/i,
	/pros?\s+and\s+cons|trade[- ]?offs?/i
];
var TECH_KEYWORDS = [
	"docker",
	"kubernetes",
	"k8s",
	"aws",
	"azure",
	"gcp",
	"terraform",
	"serverless",
	"microservices",
	"monolith",
	"container",
	"pod",
	"api",
	"rest",
	"graphql",
	"grpc",
	"websocket",
	"http",
	"tcp",
	"dns",
	"react",
	"vue",
	"angular",
	"svelte",
	"nextjs",
	"nuxt",
	"remix",
	"typescript",
	"javascript",
	"css",
	"html",
	"dom",
	"vite",
	"webpack",
	"node",
	"deno",
	"bun",
	"python",
	"java",
	"go",
	"rust",
	"fastapi",
	"express",
	"spring",
	"django",
	"laravel",
	"rails",
	"sql",
	"nosql",
	"postgresql",
	"mongodb",
	"redis",
	"elasticsearch",
	"kafka",
	"rabbitmq",
	"database",
	"orm",
	"migration",
	"machine learning",
	"deep learning",
	"llm",
	"transformer",
	"embedding",
	"vector",
	"fine-tuning",
	"rag",
	"neural network",
	"gpu",
	"arquitectura",
	"architecture",
	"pattern",
	"solid",
	"clean code",
	"algorithm",
	"algoritmo",
	"cache",
	"caché",
	"queue",
	"async",
	"ci/cd",
	"pipeline",
	"github actions",
	"jenkins",
	"monitoring",
	"logging",
	"observability",
	"prometheus",
	"grafana"
];
function detectTechnicalQuery(text) {
	const lower = text.toLowerCase();
	let matchedPattern;
	for (const pattern of QUERY_PATTERNS) if (pattern.test(lower)) {
		matchedPattern = pattern.source;
		break;
	}
	const matchedKeywords = TECH_KEYWORDS.filter((kw) => lower.includes(kw));
	let confidence = 0;
	if (matchedPattern) confidence += .6;
	confidence += Math.min(matchedKeywords.length * .15, .4);
	confidence = Math.min(confidence, 1);
	return {
		isTechnical: confidence >= .55,
		confidence,
		matchedKeywords,
		matchedPattern
	};
}
var ollamaClient = null;
var currentHost = "";
function getClient(host) {
	if (!ollamaClient || host !== currentHost) {
		ollamaClient = new Ollama({ host });
		currentHost = host;
	}
	return ollamaClient;
}
var MAX_CONTEXT_CHARS = 800;
var meetingContext = "";
function appendContext(text) {
	meetingContext = (meetingContext + " " + text).slice(-MAX_CONTEXT_CHARS).trim();
}
async function generateNote(query, ollamaModel, ollamaHost) {
	const client = getClient(ollamaHost);
	const systemPrompt = "Eres un asistente técnico en una reunión. Genera notas CONCISAS (máximo 3 líneas) sobre consultas técnicas. Responde SOLO con la nota, sin preámbulos ni explicaciones adicionales. Usa viñetas si hay más de un punto.";
	const userPrompt = `Contexto de la reunión: "${meetingContext}"\n\nConsulta detectada: "${query}"\n\nEscribe una nota técnica breve y útil.`;
	return (await client.chat({
		model: ollamaModel,
		messages: [{
			role: "system",
			content: systemPrompt
		}, {
			role: "user",
			content: userPrompt
		}],
		stream: false
	})).message.content.trim();
}
function setupLLMIPC(win) {
	ipcMain.handle("llm:generate-note", async (_e, query, ollamaModel, ollamaHost) => {
		return await generateNote(query, ollamaModel, ollamaHost);
	});
	win.webContents.once("destroyed", () => {
		ipcMain.removeHandler("llm:generate-note");
	});
}
function emitNote(win, triggerText, noteText, confidence) {
	const note = {
		id: v4(),
		text: noteText,
		timestamp: Date.now(),
		triggerText,
		confidence
	};
	win.webContents.send("note:generated", note);
}
/**
* Whisper transcription via @xenova/transformers (ONNX Runtime).
*
* Runs in the Electron main process (Node.js).
* @xenova/transformers uses onnxruntime-node which ships prebuilt binaries for
* Node.js 20/22 — compatible with Electron 40 (Node 22) without compilation.
*
* If you see a native-module error on first run, execute:
*   npx electron-rebuild -f -w @xenova/transformers
*/
var asr = null;
var modelLoading = false;
var modelReady = false;
async function loadWhisperModel(modelName, onProgress) {
	if (asr || modelLoading) return;
	modelLoading = true;
	try {
		const { pipeline, env } = await import("@xenova/transformers");
		env.cacheDir = path.join(app.getPath("userData"), ".models");
		env.allowRemoteModels = true;
		asr = await pipeline("automatic-speech-recognition", modelName, { progress_callback: (p) => {
			if (typeof p?.progress === "number") onProgress({
				progress: Math.round(p.progress),
				status: p.status ?? ""
			});
		} });
		modelReady = true;
	} catch (err) {
		modelLoading = false;
		throw err;
	}
	modelLoading = false;
}
async function transcribeBuffer(audioData, language) {
	if (!asr) throw new Error("Whisper model not loaded");
	const result = await asr(audioData, {
		language: language === "auto" ? void 0 : language,
		task: "transcribe",
		return_timestamps: false
	});
	if (Array.isArray(result)) return result.map((r) => String(r?.text ?? "")).join(" ").trim();
	return String(result?.text ?? "").trim();
}
function setupTranscriberIPC(win) {
	ipcMain.handle("transcribe:load-model", async (_e, modelName) => {
		await loadWhisperModel(modelName, (ev) => {
			win.webContents.send("transcribe:model-progress", ev);
		});
	});
	ipcMain.handle("transcribe:is-ready", () => modelReady);
	ipcMain.handle("transcribe:chunk", async (_e, buffer, source, language, ollamaModel, ollamaHost) => {
		const text = await transcribeBuffer(new Float32Array(buffer), language);
		if (!text) return {
			text: "",
			source,
			isTechnicalQuery: false,
			confidence: 0
		};
		const detection = detectTechnicalQuery(text);
		appendContext(text);
		const entry = {
			id: v4(),
			text,
			timestamp: Date.now(),
			source,
			isTechnicalQuery: detection.isTechnical
		};
		win.webContents.send("transcript:new", entry);
		if (detection.isTechnical) generateNote(text, ollamaModel, ollamaHost).then((noteText) => {
			if (noteText) emitNote(win, text, noteText, detection.confidence);
		}).catch((err) => {
			console.error("[LLM] Note generation failed:", err);
		});
		return {
			text,
			source,
			isTechnicalQuery: detection.isTechnical,
			confidence: detection.confidence
		};
	});
	win.webContents.once("destroyed", () => {
		ipcMain.removeHandler("transcribe:load-model");
		ipcMain.removeHandler("transcribe:is-ready");
		ipcMain.removeHandler("transcribe:chunk");
	});
}
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env["APP_ROOT"] = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var RENDERER_DIST = path.join(process.env["APP_ROOT"], "dist");
var PRELOAD_PATH = path.join(__dirname, "preload.js");
process.env["VITE_PUBLIC"] = VITE_DEV_SERVER_URL ? path.join(process.env["APP_ROOT"], "public") : RENDERER_DIST;
var store = new Store({ defaults: {
	colorTheme: "midnight",
	opacity: .95,
	alwaysOnTop: false,
	whisperModel: "Xenova/whisper-tiny",
	ollamaModel: "llama3.2",
	ollamaHost: "http://localhost:11434",
	language: "es"
} });
var win = null;
function createWindow() {
	win = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 960,
		minHeight: 600,
		frame: false,
		transparent: true,
		backgroundColor: "#00000000",
		opacity: store.get("opacity") ?? .95,
		show: false,
		webPreferences: {
			preload: PRELOAD_PATH,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	});
	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL);
		win.webContents.openDevTools({ mode: "detach" });
	} else win.loadFile(path.join(RENDERER_DIST, "index.html"));
	win.once("ready-to-show", () => {
		win?.show();
		if (store.get("alwaysOnTop") === true) win?.setAlwaysOnTop(true, "screen-saver");
	});
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	ipcMain.handle("window:minimize", () => win?.minimize());
	ipcMain.handle("window:maximize", () => {
		if (win?.isMaximized()) win.unmaximize();
		else win?.maximize();
	});
	ipcMain.handle("window:close", () => win?.close());
	ipcMain.handle("window:set-opacity", (_e, opacity) => {
		const clamped = Math.max(.2, Math.min(1, opacity));
		win?.setOpacity(clamped);
		store.set("opacity", clamped);
	});
	ipcMain.handle("window:set-always-on-top", (_e, value) => {
		win?.setAlwaysOnTop(value, "screen-saver");
		store.set("alwaysOnTop", value);
	});
	ipcMain.handle("settings:get", () => store.store);
	ipcMain.handle("settings:save", (_e, patch) => {
		for (const [key, value] of Object.entries(patch)) store.set(key, value);
	});
	setupAudioIPC();
	setupTranscriberIPC(win);
	setupLLMIPC(win);
	win.on("closed", () => {
		ipcMain.removeHandler("window:minimize");
		ipcMain.removeHandler("window:maximize");
		ipcMain.removeHandler("window:close");
		ipcMain.removeHandler("window:set-opacity");
		ipcMain.removeHandler("window:set-always-on-top");
		ipcMain.removeHandler("settings:get");
		ipcMain.removeHandler("settings:save");
		ipcMain.removeHandler("audio:get-sources");
		win = null;
	});
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

//# sourceMappingURL=main.js.map