import PyPDF2

def extract_text(pdf_path):
    with open(pdf_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

path = r"c:\Users\compu\Downloads\test d2 ia\PLC_Professional\Formato_PLC_informe_final_entregado.pdf"
try:
    content = extract_text(path)
    with open("extracted_final_report.txt", "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ Text extracted to extracted_final_report.txt")
except Exception as e:
    print(f"❌ Error: {e}")
