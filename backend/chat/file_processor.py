import os
import logging
import tempfile
import shutil
from typing import List, Union
import pypdf
import docx
import pymupdf4llm
from django.core.files import File

logger = logging.getLogger(__name__)

class FileProcessor:
    @staticmethod
    def extract_text(file_source: Union[str, File], mime_type: str = None) -> str:
        """
        Extrai texto de arquivos PDF, DOCX ou TXT.
        Aceita caminho de arquivo (str) ou objeto Django File.
        Se for arquivo remoto (GCS), baixa para tempfile.
        """
        temp_path = None
        file_path = ""

        try:
            # 1. Resolver o caminho do arquivo (local ou temp)
            if isinstance(file_source, str):
                file_path = file_source
                if not os.path.exists(file_path):
                    # Se não é path local, assumimos que pode ser path de storage que precisa ser aberto via open()
                    # Mas se file_source é str, assumimos path físico.
                    # Se não existe, erro.
                    logger.error(f"FileProcessor: Arquivo não encontrado em {file_path}")
                    return ""
            else:
                # É um objeto File (FieldFile)
                if hasattr(file_source, 'path') and os.path.exists(file_source.path):
                    file_path = file_source.path
                else:
                    # Arquivo remoto (GCS) ou em memória -> baixar para temp
                    with tempfile.NamedTemporaryFile(delete=False) as tmp:
                        file_source.open('rb')
                        shutil.copyfileobj(file_source, tmp)
                        temp_path = tmp.name
                        file_path = temp_path

                    # Tentar inferir nome para extensão
                    if hasattr(file_source, 'name'):
                        ext = os.path.splitext(file_source.name)[1]
                        if ext and not temp_path.endswith(ext):
                            new_path = temp_path + ext
                            shutil.move(temp_path, new_path)
                            temp_path = new_path
                            file_path = new_path

            # 2. Inferir Mime Type
            if not mime_type:
                filename = file_path
                if isinstance(file_source, File) and hasattr(file_source, 'name'):
                    filename = file_source.name

                lower_name = filename.lower()
                if lower_name.endswith('.pdf'):
                    mime_type = 'application/pdf'
                elif lower_name.endswith('.docx'):
                    mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                elif lower_name.endswith('.txt'):
                    mime_type = 'text/plain'

            text = ""
            is_markdown = False

            # --- Processamento PDF ---
            if mime_type == 'application/pdf':
                try:
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

            if is_markdown:
                return text
            return " ".join(text.split())

        except Exception as e:
            logger.error(f"Erro genérico no FileProcessor: {e}")
            return ""
        finally:
            # Cleanup temp file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except: pass

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        if not text: return []
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = start + chunk_size
            if end < text_len:
                last_space = text.rfind(' ', max(start, end - 100), end)
                if last_space != -1:
                    end = last_space
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= text_len:
                break
            start = end - overlap
        return chunks
