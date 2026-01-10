import { KnowledgeArtifact, ArtifactType } from '../types/studio';
import * as FileSystem from 'expo-file-system/legacy';
import { BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';

// In-memory store for mock data
let MOCK_STORE: KnowledgeArtifact[] = [
    {
        id: '1',
        chatId: 'mock-chat-id',
        type: 'PODCAST',
        title: 'Resumo da Aula 1',
        status: 'ready',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        duration: '5:20',
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    },
    {
        id: '2',
        chatId: 'mock-chat-id',
        type: 'SUMMARY',
        title: 'Notas sobre Derivadas',
        status: 'ready',
        content: 'Derivadas representam a taxa de variação instantânea de uma função...',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    },
    {
        id: '3',
        chatId: 'mock-chat-id',
        type: 'QUIZ',
        title: 'Teste Rápido: Limites',
        status: 'ready',
        score: '8/10',
        content: [
            { question: 'Qual o limite de 1/x quando x tende a infinito?', options: ['0', '1', 'Infinito', 'Indefinido'], correctAnswerIndex: 0 },
            { question: 'Derivada de x^2?', options: ['x', '2x', '2', 'x^2'], correctAnswerIndex: 1 }
        ],
        createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    },
    {
        id: '4',
        chatId: 'mock-chat-id',
        type: 'FLASHCARD',
        title: 'Guia de Estudo: Cálculo I',
        status: 'ready',
        content: [
             { front: 'Teorema Fundamental do Cálculo', back: 'Relaciona diferenciação e integração...' },
             { front: 'Regra da Cadeia', back: 'f(g(x))\' = f\'(g(x)) * g\'(x)' }
        ],
        createdAt: new Date(Date.now() - 604800000).toISOString(), // Last week
    },
    {
        id: '5',
        chatId: 'mock-chat-id',
        type: 'SLIDE',
        title: 'Apresentação: Integrais',
        status: 'ready',
        content: [
            { title: 'Introdução às Integrais', bullets: ['Definição de área sob a curva', 'Notação de Leibniz', 'Soma de Riemann'] },
            { title: 'Técnicas de Integração', bullets: ['Substituição', 'Por partes', 'Frações parciais'] },
            { title: 'Aplicações', bullets: ['Cálculo de volume', 'Trabalho físico', 'Probabilidade'] }
        ],
        createdAt: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
    },
    {
        id: '6',
        chatId: 'mock-chat-id',
        type: 'SPREADSHEET',
        title: 'Tabela de Fórmulas',
        status: 'ready',
        content: 'Mock content for spreadsheet view', // Future: structured data
        createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
    },
    {
        id: '7',
        chatId: 'mock-chat-id',
        type: 'WORKBOOK',
        title: 'Apostila Completa: Módulo 1',
        status: 'ready',
        content: 'Mock content for workbook PDF view',
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    }
];

export const studioService = {
    async getArtifacts(chatId: string): Promise<KnowledgeArtifact[]> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        // Filter by chatId? For mock we just return all or mix
        return MOCK_STORE;
    },

    async generateArtifact(chatId: string, type: ArtifactType, title: string): Promise<KnowledgeArtifact> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const newArtifact: KnowledgeArtifact = {
            id: Date.now().toString(),
            chatId,
            type,
            title,
            status: 'processing',
            createdAt: new Date().toISOString()
        };

        MOCK_STORE = [newArtifact, ...MOCK_STORE];

        // Simulate background processing
        setTimeout(() => {
            const index = MOCK_STORE.findIndex(a => a.id === newArtifact.id);
            if (index !== -1) {
                MOCK_STORE[index] = { ...MOCK_STORE[index], status: 'ready' };
                // Need a way to notify listeners? For now, the UI will poll or re-fetch on navigation
            }
        }, 4000);

        return newArtifact;
    },

    /**
     * Exports an artifact by downloading it from the backend API.
     */
    async exportArtifact(artifactId: string, format: string): Promise<string> {
        const artifact = MOCK_STORE.find(a => a.id === artifactId);
        if (!artifact) throw new Error('Artifact not found');

        const fileName = `${artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const token = useAuthStore.getState().token;

        // Use the actual backend endpoint (prepared for when it's ready)
        // If the backend is not reachable, this will throw, which is correct behavior for "integration ready" code.
        try {
            const downloadRes = await FileSystem.downloadAsync(
                `${BASE_URL}/api/v1/studio/artifacts/${artifactId}/export?format=${format}`,
                fileUri,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (downloadRes.status !== 200) {
                // If backend 404s/fails (likely right now), fallback to mock generation for demo purposes
                // ONLY if we are in DEV mode, to allow UI testing to continue.
                if (__DEV__) {
                    console.warn("Backend export failed, falling back to mock generation for demo.");
                    let content = 'Mock Data Content';
                    await FileSystem.writeAsStringAsync(fileUri, content);
                    return fileUri;
                }
                throw new Error(`Download failed with status ${downloadRes.status}`);
            }

            return downloadRes.uri;
        } catch (e) {
            console.error("Export error:", e);
            // Fallback for demo continuity
            if (__DEV__) {
                 let content = 'Mock Data Content (Fallback)';
                 await FileSystem.writeAsStringAsync(fileUri, content);
                 return fileUri;
            }
            throw e;
        }
    }
};
