// --- SPA ROUTER AND APP LOGIC ---

const appContainer = document.getElementById('app');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

// --- API HELPERS ---
const ANILIST_API_URL = 'https://graphql.anilist.co';

async function fetchAniListData(query, variables) {
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables })
    };
    try {
        const response = await fetch(ANILIST_API_URL, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching from AniList API:', error);
        appContainer.innerHTML = `<p class="text-center text-red-400 col-span-full">Failed to load data. Please try again later.</p>`;
        return null;
    }
}

async function fetchGeminiData(prompt) {
     const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    recommendations: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: { title: { type: "STRING" }, reason: { type: "STRING" } },
                            required: ["title", "reason"]
                        }
                    }
                },
                required: ["recommendations"]
            }
        }
    };
    const apiKey = ""; // IMPORTANT: You would need to get your own API key for Gemini
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.candidates && result.candidates[0].content.parts[0].text) {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        }
        throw new Error("Unexpected API response structure.");
    } catch (error) {
        console.error("Error fetching AI recommendations:", error);
        return null;
    }
}


// --- UI COMPONENTS (as functions returning HTML strings) ---

const UILoader = () => `<div class="flex justify-center items-center h-64"><div class="loader"></div></div>`;

const UINoResults = (message = "No Results Found", subtext = "Maybe try a different keyword?") => `
    <div class="text-center py-16 page">
        <h3 class="text-2xl font-semibold text-neutral-300">${message}</h3>
        <p class="text-neutral-400 mt-2">${subtext}</p>
    </div>`;

const UIAnimeCard = (anime) => {
    const title = anime.title.english || anime.title.romaji;
    return `
        <a href="/anime/${anime.id}" class="anime-card group" data-link>
            <div class="relative">
                <img src="${anime.coverImage.extraLarge}" alt="${title}" class="w-full h-72 md:h-80 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/400x600/111111/ef4444?text=No+Image';">
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                ${anime.averageScore ? `<div class="absolute top-3 right-3 bg-red-600/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full">${anime.averageScore}</div>` : ''}
                <div class="absolute bottom-0 left-0 right-0 p-4">
                    <h3 class="text-white font-bold text-base truncate group-hover:whitespace-normal transition">${title}</h3>
                </div>
            </div>
        </a>
    `;
};

const UIGrid = (animes) => `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
        ${animes.map(UIAnimeCard).join('')}
    </div>`;


// --- PAGE VIEWS ---

const HomePage = {
    render: async () => {
        appContainer.innerHTML = UILoader();
        const query = `
            query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
                Page(page: $page, perPage: $perPage) {
                    media(type: ANIME, sort: $sort) {
                        id title { romaji english }
                        coverImage { extraLarge }
                        averageScore
                    }
                }
            }`;
        const data = await fetchAniListData(query, { page: 1, perPage: 18, sort: ['TRENDING_DESC', 'POPULARITY_DESC'] });
        if (data && data.data.Page.media.length > 0) {
            appContainer.innerHTML = `
                <div class="page">
                    <h2 class="text-3xl font-bold mb-8 text-neutral-200 tracking-tight">Trending Now</h2>
                    ${UIGrid(data.data.Page.media)}
                </div>`;
        } else {
            appContainer.innerHTML = UINoResults("Could not load trending anime.");
        }
    }
};

const SearchPage = {
    render: async (params) => {
        const searchTerm = decodeURIComponent(params.query);
        appContainer.innerHTML = UILoader();
        searchInput.value = searchTerm;
        const query = `
            query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort]) {
                Page(page: $page, perPage: $perPage) {
                    media(search: $search, type: ANIME, sort: $sort) {
                        id title { romaji english }
                        coverImage { extraLarge }
                        averageScore
                    }
                }
            }`;
        const data = await fetchAniListData(query, { search: searchTerm, page: 1, perPage: 18, sort: ['SEARCH_MATCH'] });
         if (data && data.data.Page.media.length > 0) {
            appContainer.innerHTML = `
                <div class="page">
                    <h2 class="text-3xl font-bold mb-8 text-neutral-200 tracking-tight">Results for "${searchTerm}"</h2>
                    ${UIGrid(data.data.Page.media)}
                </div>`;
        } else {
            appContainer.innerHTML = UINoResults(`No results for "${searchTerm}"`);
        }
    }
};

const DetailPage = {
    render: async (params) => {
        appContainer.innerHTML = UILoader();
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    title { romaji english }
                    coverImage { extraLarge }
                    bannerImage
                    description(asHtml: false)
                    genres
                    averageScore
                    format
                    status
                    episodes
                    duration
                    season
                    seasonYear
                    source(version: 2)
                    studios(isMain: true) {
                        nodes {
                            name
                        }
                    }
                    trailer {
                        id
                        site
                    }
                }
            }`;
        const data = await fetchAniListData(query, { id: parseInt(params.id) });
        if (data && data.data.Media) {
            const anime = data.data.Media;
            const title = anime.title.english || anime.title.romaji;
            const description = anime.description ? anime.description.replace(/<br\s*\/?>/gi, ' ').substring(0, 400) + '...' : 'No description available.';
            const mainStudio = anime.studios.nodes.length > 0 ? anime.studios.nodes[0].name : 'N/A';
            const trailerUrl = anime.trailer && anime.trailer.site === 'youtube' ? `https://www.youtube.com/watch?v=${anime.trailer.id}` : null;

            // Helper to format text
            const formatText = (text) => text ? text.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';

            appContainer.innerHTML = `
                <div class="page">
                    <div class="w-full h-48 md:h-64 lg:h-80 rounded-2xl bg-cover bg-center" style="background-image: url('${anime.bannerImage || anime.coverImage.extraLarge}')">
                        <div class="w-full h-full bg-black/60 rounded-2xl"></div>
                    </div>
                    <div class="flex flex-col md:flex-row gap-8 -mt-24 md:-mt-32 px-4 md:px-8">
                        <div class="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                            <img src="${anime.coverImage.extraLarge}" alt="${title}" class="rounded-xl shadow-2xl w-full aspect-[2/3] object-cover">
                            ${trailerUrl ? `<a href="${trailerUrl}" target="_blank" rel="noopener noreferrer" class="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>
                                Watch Trailer
                            </a>` : ''}
                        </div>
                        <div class="w-full md:w-2/3 lg:w-3/4 pt-4 md:pt-32">
                            <h1 class="text-3xl md:text-5xl font-extrabold text-white">${title}</h1>
                            <div class="flex flex-wrap gap-2 my-4">
                                ${anime.genres.map(g => `<span class="bg-white/10 text-red-400 text-xs font-semibold px-3 py-1 rounded-full">${g}</span>`).join('')}
                            </div>
                            <p class="text-neutral-300 text-sm md:text-base leading-relaxed mb-6">${description}</p>

                            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Format</span><br>${formatText(anime.format)}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Status</span><br>${formatText(anime.status)}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Episodes</span><br>${anime.episodes || 'N/A'}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Duration</span><br>${anime.duration ? `${anime.duration} min` : 'N/A'}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Season</span><br>${formatText(anime.season)} ${anime.seasonYear || ''}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Studio</span><br>${mainStudio}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Source</span><br>${formatText(anime.source)}</div>
                                <div class="bg-white/5 p-3 rounded-lg"><span class="font-bold text-white">Score</span><br>${anime.averageScore ? `${anime.averageScore} / 100` : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="px-4 md:px-8 mt-12">
                         <div class="mt-auto pt-6 border-t border-white/10">
                            <h2 class="text-2xl font-bold mb-4 text-white">AI Recommendations</h2>
                            <button id="ai-rec-btn" class="w-full max-w-sm bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2">
                                ✨ Get Similar Anime
                            </button>
                            <div id="ai-rec-loader" class="flex justify-center items-center h-24 hidden mt-4">${UILoader()}</div>
                            <div id="ai-rec-results" class="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 hidden"></div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('ai-rec-btn').addEventListener('click', async () => {
                document.getElementById('ai-rec-btn').classList.add('hidden');
                document.getElementById('ai-rec-loader').classList.remove('hidden');
                const resultsContainer = document.getElementById('ai-rec-results');

                const prompt = `I enjoyed the anime "${title}", which is known for its [${anime.genres.join(', ')}] genres. Based on this, recommend 3 other anime that I would likely enjoy. For each recommendation, provide a compelling, one-sentence reason explaining the connection.`;
                const aiData = await fetchGeminiData(prompt);

                document.getElementById('ai-rec-loader').classList.add('hidden');
                resultsContainer.classList.remove('hidden');
                if (aiData && aiData.recommendations) {
                    resultsContainer.innerHTML = aiData.recommendations.map(rec => `
                        <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                            <h4 class="font-semibold text-white">${rec.title}</h4>
                            <p class="text-sm text-neutral-300 mt-1">${rec.reason}</p>
                        </div>
                    `).join('');
                } else {
                    resultsContainer.innerHTML = `<p class="text-center text-neutral-400 col-span-full">Could not generate recommendations at this time.</p>`;
                }
            });
        } else {
            appContainer.innerHTML = UINoResults("Anime not found.");
        }
    }
};

// --- ROUTER LOGIC ---
const pathToRegex = path => new RegExp("^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "(.+)") + "$");

const getParams = match => {
    const values = match.result.slice(1);
    const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(result => result[1]);
    return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
};

const router = async () => {
    const routes = [
        { path: "/", view: HomePage },
        { path: "/search/:query", view: SearchPage },
        { path: "/anime/:id", view: DetailPage }
    ];

    const potentialMatches = routes.map(route => {
        return {
            route: route,
            result: location.pathname.match(pathToRegex(route.path))
        };
    });

    let match = potentialMatches.find(potentialMatch => potentialMatch.result !== null);

    if (!match) {
        match = {
            route: routes[0],
            result: [location.pathname]
        };
    }

    await match.route.view.render(getParams(match));
    window.scrollTo(0, 0);
};

const navigateTo = url => {
    history.pushState(null, null, url);
    router();
};

// --- EVENT LISTENERS ---
window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", e => {
        const targetLink = e.target.closest('[data-link]');
        if (targetLink) {
            e.preventDefault();
            navigateTo(targetLink.getAttribute('href'));
        }
    });

    searchForm.addEventListener('submit', e => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if(searchTerm) {
            navigateTo(`/search/${encodeURIComponent(searchTerm)}`);
        }
    });

    router();
});
