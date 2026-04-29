export const LANDING_PAGE_HTML = (apiUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice-SEO Content Optimizer (VCO) | Zero-Latency API</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        :root {
            --primary: #7c3aed;
            --primary-glow: rgba(124, 58, 237, 0.4);
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --text: #f8fafc;
            --text-dim: #94a3b8;
            --accent: #2dd4bf;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(124, 58, 237, 0.1) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(45, 212, 191, 0.1) 0%, transparent 40%);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 2rem;
            width: 100%;
        }

        header {
            text-align: center;
            margin-bottom: 4rem;
            animation: fadeInDown 0.8s ease-out;
        }

        .badge {
            display: inline-block;
            background: rgba(124, 58, 237, 0.1);
            color: var(--primary);
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(124, 58, 237, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            background: linear-gradient(to right, #fff, var(--primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.02em;
        }

        .tagline {
            font-size: 1.25rem;
            color: var(--text-dim);
            max-width: 600px;
            margin: 0 auto;
        }

        .main-grid {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 2rem;
            margin-bottom: 4rem;
        }

        .card {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1.5rem;
            padding: 2rem;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .card:hover {
            border-color: rgba(124, 58, 237, 0.5);
        }

        .input-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        h2 {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.25rem;
            font-weight: 600;
        }

        textarea {
            width: 100%;
            height: 300px;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            padding: 1.25rem;
            color: var(--text);
            font-family: inherit;
            font-size: 1rem;
            resize: none;
            transition: all 0.3s ease;
            outline: none;
        }

        textarea:focus {
            border-color: var(--primary);
            box-shadow: 0 0 20px var(--primary-glow);
        }

        .controls {
            display: flex;
            gap: 1rem;
            margin-top: 1.5rem;
        }

        select {
            flex: 1;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.75rem;
            padding: 0 1rem;
            color: var(--text);
            outline: none;
            cursor: pointer;
        }

        button {
            flex: 1;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 0.75rem;
            padding: 1rem 2rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px var(--primary-glow);
        }

        button:active {
            transform: translateY(0);
        }

        .results-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .result-group {
            opacity: 0;
            transform: translateY(20px);
        }

        .result-group.active {
            animation: fadeInUp 0.5s forwards;
        }

        .score-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 1rem;
            background: rgba(45, 212, 191, 0.1);
            color: var(--accent);
            font-weight: 700;
            margin-bottom: 1rem;
        }

        .script-output {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 1.5rem;
            border-radius: 1rem;
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            white-space: pre-wrap;
        }

        .code-output {
            background: #000;
            padding: 1rem;
            border-radius: 0.75rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            overflow-x: auto;
            color: #6ee7b7;
            max-height: 200px;
        }

        .features-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 1rem;
        }

        .chip {
            background: rgba(255, 255, 255, 0.05);
            padding: 0.25rem 0.75rem;
            border-radius: 0.5rem;
            font-size: 0.8rem;
            color: var(--text-dim);
        }

        footer {
            margin-top: auto;
            padding: 4rem 2rem 2rem;
            text-align: center;
            color: var(--text-dim);
            font-size: 0.875rem;
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
            to { opacity: 1; transform: translateY(0); }
        }

        .loading {
            pointer-events: none;
            opacity: 0.7;
        }

        .loading i {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
            .main-grid {
                grid-template-columns: 1fr;
            }
            h1 { font-size: 2.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <span class="badge">Edge Runtime &middot; Zero LLM</span>
            <h1>Voice-SEO Content Optimizer</h1>
            <p class="tagline">Transform static e-commerce descriptions into high-cadence voice scripts. Millisecond latency, privacy-safe, deterministic engine.</p>
        </header>

        <main class="main-grid">
            <section class="card">
                <div class="input-header">
                    <h2><i data-lucide="edit-3"></i> Product Info</h2>
                </div>
                <textarea id="inputText" placeholder="Paste your product description here...&#10;예: 본 제품은 IPX7 방수 등급을 지원하며 배터리는 10시간 지속됩니다. 상세페이지 참조."></textarea>
                <div class="controls">
                    <select id="styleSelect">
                        <option value="friendly">Friendly</option>
                        <option value="enthusiastic">Enthusiastic</option>
                        <option value="formal">Formal</option>
                    </select>
                    <button id="optimizeBtn">
                        <i data-lucide="sparkles"></i> Optimize
                    </button>
                </div>
            </section>

            <section class="card" id="resultsCard" style="display: none;">
                <div class="results-container">
                    <div class="result-group active">
                        <div class="score-pill">
                            <i data-lucide="zap"></i> VCS Score: <span id="vcsScore">--</span>
                        </div>
                        <h2><i data-lucide="mic-2"></i> Voice Optimized Script</h2>
                        <div class="script-output" id="voiceScript">--</div>
                    </div>

                    <div class="result-group active" style="animation-delay: 0.1s;">
                        <h2><i data-lucide="code"></i> Auto SSML Markup</h2>
                        <div class="code-output" id="ssmlOutput">--</div>
                    </div>

                    <div class="result-group active" style="animation-delay: 0.2s;">
                        <h2><i data-lucide="box"></i> Extracted Entities</h2>
                        <div class="features-chips" id="entitiesOutput">
                            <!-- chips here -->
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <footer>
            <p>&copy; 2026 VCO Engine v1.0.0. Powered by Cloudflare Workers & Deterministic Logic.</p>
        </footer title="Developer Info">
    </div>

    <script>
        lucide.createIcons();
        const apiUrl = "${apiUrl}";

        const optimizeBtn = document.getElementById('optimizeBtn');
        const resultsCard = document.getElementById('resultsCard');
        const inputText = document.getElementById('inputText');
        const styleSelect = document.getElementById('styleSelect');

        optimizeBtn.addEventListener('click', async () => {
            const text = inputText.value.trim();
            if (!text) return alert('Please enter some text!');

            optimizeBtn.classList.add('loading');
            optimizeBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Processing...';
            lucide.createIcons();

            try {
                const response = await fetch('/v1/optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text, 
                        style: styleSelect.value,
                        lang: 'auto'
                    })
                });

                const json = await response.json();
                if (!json.success) throw new Error(json.error.message);

                const data = json.data;
                
                // Show results
                resultsCard.style.display = 'block';
                document.getElementById('vcsScore').textContent = data.optimized.cadenceScore;
                document.getElementById('voiceScript').textContent = data.optimized.voiceScript;
                document.getElementById('ssmlOutput').textContent = data.ssml.ssml;

                const entitiesDiv = document.getElementById('entitiesOutput');
                entitiesDiv.innerHTML = '';
                
                // Features
                data.entities.features.forEach(f => {
                    const chip = document.createElement('span');
                    chip.className = 'chip';
                    chip.textContent = '✨ ' + f;
                    entitiesDiv.appendChild(chip);
                });

                // Price
                if (data.entities.price) {
                    const chip = document.createElement('span');
                    chip.className = 'chip';
                    chip.style.color = '#fbbf24';
                    chip.textContent = '💰 ' + data.entities.price;
                    entitiesDiv.appendChild(chip);
                }

                // Smooth scroll to results
                resultsCard.scrollIntoView({ behavior: 'smooth' });

            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                optimizeBtn.classList.remove('loading');
                optimizeBtn.innerHTML = '<i data-lucide="sparkles"></i> Optimize';
                lucide.createIcons();
            }
        });
    </script>
</body>
</html>
`;
