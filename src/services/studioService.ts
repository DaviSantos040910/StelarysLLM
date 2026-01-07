import { KnowledgeArtifact, ArtifactType } from '../types/studio';

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
    }
};
