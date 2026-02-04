import os
import logging
from typing import List
import pypdf
import docx
import pymupdf4llm

logger = logging.getLogger(__name__)

class FileProcessor:
    @staticmethod
    def extract_text(file_path: str, mime_type: str = None) -> str:
        """
        Extrai texto de arquivos PDF, DOCX ou TXT de forma robusta.
        """
        if not os.path.exists(file_path):
            logger.error(f"FileProcessor: Arquivo não encontrado em {file_path}")
            return ""

        text = ""
        is_markdown = False

        try:
            # Tenta inferir mime_type pela extensão se não fornecido
            if not mime_type:
                if file_path.lower().endswith('.pdf'):
                    mime_type = 'application/pdf'
                elif file_path.lower().endswith('.docx'):
                    mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                elif file_path.lower().endswith('.txt'):
                    mime_type = 'text/plain'

            # --- Processamento PDF ---
            if mime_type == 'application/pdf':
                try:
                    # Modernização: Usa PyMuPDF4LLM para extrair Markdown (melhor para tabelas)
                    text = pymupdf4llm.to_markdown(file_path)
                    is_markdown = True
                except Exception as e:
                    logger.warning(f"PyMuPDF4LLM falhou, tentando pypdf fallback: {e}")
                    try:
                        reader = pypdf.PdfReader(file_path)
                        for page in reader.pages:
                            page_text = page.extract_text()
                            if page_text:
                                text += page_text + "\n"
                    except Exception as e2:
                         logger.error(f"Erro ao ler PDF: {e2}")

            # --- Processamento DOCX ---
            elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                try:
                    doc = docx.Document(file_path)
                    text = '\n'.join([para.text for para in doc.paragraphs if para.text.strip()])
                except Exception as e:
                    logger.error(f"Erro ao ler DOCX: {e}")

            # --- Processamento Texto Puro ---
            elif mime_type and mime_type.startswith('text/'):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        text = f.read()
                except Exception as e:
                    logger.error(f"Erro ao ler TXT: {e}")

            else:
                logger.warning(f"Tipo de arquivo não suportado para extração: {mime_type}")

        except Exception as e:
            logger.error(f"Erro genérico no FileProcessor ({file_path}): {e}")
            return ""

        # Se for Markdown, preservamos a formatação (quebras de linha são importantes)
        if is_markdown:
            return text

        # Limpeza básica: remove excesso de espaços em branco e quebras de linha múltiplas para texto plano
        return " ".join(text.split())

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Divide o texto em blocos menores com sobreposição (overlap) para manter contexto.
        """
        if not text: return []

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + chunk_size

            # Tenta não cortar palavras no meio: procura o último espaço antes do corte
            if end < text_len:
                last_space = text.rfind(' ', max(start, end - 100), end)
                if last_space != -1:
                    end = last_space

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Se atingiu o final, para
            if end >= text_len:
                break

            # Avança o cursor, recuando pelo tamanho do overlap para garantir continuidade
            start = end - overlap

        return chunks
