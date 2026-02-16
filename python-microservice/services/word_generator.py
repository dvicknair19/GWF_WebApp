import os
import re
from datetime import datetime
from docx import Document
from docx.shared import Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Configuration for Template
TEMPLATE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/templates'
# Try to find the correct template file dynamically or use specific name
TEMPLATE_FILENAME = "TEMPLATE 2026 GWFMOA_(Client)_(Vendor)_(mo,yr).docx"

def _sanitize_filename(name: str) -> str:
    # Remove invalid filename characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '', name)
    # Replace multiple spaces/underscores with single underscore
    sanitized = re.sub(r'[\s_]+', '_', sanitized)
    return sanitized.strip(' _')

def get_template_path():
    # First check for the specific new template
    path = os.path.join(TEMPLATE_DIR, TEMPLATE_FILENAME)
    if os.path.exists(path):
        return path
    
    # Fallback: look for any docx in templates folder that looks right
    if os.path.exists(TEMPLATE_DIR):
        for f in os.listdir(TEMPLATE_DIR):
            if f.endswith('.docx') and 'GWFMOA' in f:
                return os.path.join(TEMPLATE_DIR, f)
    
    # Final fallback to env var or default
    return os.getenv('TEMPLATE_PATH', path)

def generate_vendor_profile(client_name, vendor_name, deal_description, research_data):
    template_path = get_template_path()
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")

    doc = Document(template_path)

    # Prepare data - map research_data keys to match the document service expectations
    mapped_data = research_data.copy()
    mapped_data['deal_description'] = deal_description

    # Populate document using the logic ported from document_service.py
    _populate_document(doc, mapped_data)

    # Legacy Placeholder Replacement (Safety net for simple templates)
    # Replaces [CLIENT_NAME] etc in logic
    for p in doc.paragraphs:
        if '[CLIENT_NAME]' in p.text:
            p.text = p.text.replace('[CLIENT_NAME]', client_name)
        if '[VENDOR_NAME]' in p.text:
            p.text = p.text.replace('[VENDOR_NAME]', vendor_name)
    
    # Save to temporary file
    output_filename = f"Generated_{client_name}_{vendor_name}.docx"
    safe_filename = _sanitize_filename(output_filename)
    output_path = os.path.join('/tmp', safe_filename)
    doc.save(output_path)
    
    return output_path

# --- Helper functions ported and adapted from document_service.py ---

def _populate_document(doc, vendor_data):
    """Populate document tables with vendor data."""
    for table in doc.tables:
        _populate_table(table, vendor_data)

def _populate_table(table, vendor_data):
    """Populate a single table with vendor data."""
    # Special handlers
    _handle_vendor_profile_paragraph(table, vendor_data)

    for row in table.rows:
        if len(row.cells) >= 2:
            label_cell = row.cells[0]
            value_cell = row.cells[1]
            label_text = label_cell.text.strip().lower()

            # Mapping logic
            if "company type" in label_text:
                _set_cell_value(value_cell, vendor_data.get("company_type", ""))
            elif "fiscal year end" in label_text:
                _set_cell_value(value_cell, vendor_data.get("fiscal_year_end", ""))
            elif "estimated annual revenue" in label_text or "revenue" in label_text:
                _set_cell_value(value_cell, vendor_data.get("estimated_annual_revenue", ""))
            elif "employees" in label_text or "employee" in label_text:
                _set_cell_value(value_cell, vendor_data.get("employees", ""))
            elif "competitors" in label_text and "core" in label_text:
                competitors = vendor_data.get("competitors_core", [])
                if isinstance(competitors, list):
                    _set_cell_value(value_cell, ", ".join(competitors))
                else:
                    _set_cell_value(value_cell, str(competitors) if competitors else "")
            elif "recent news" in label_text or "news" in label_text:
                news_list = vendor_data.get("recent_news", [])
                _set_news_list(value_cell, news_list)
            elif "deal description" in label_text:
                _set_cell_value(value_cell, vendor_data.get("deal_description", ""))

def _handle_vendor_profile_paragraph(table, vendor_data):
    """Handle special vendor profile paragraph placement."""
    for i, row in enumerate(table.rows):
        if len(row.cells) >= 1:
            label_text = row.cells[0].text.strip().lower()
            # Look for 'Vendor Profile' header and populate the cell below it
            if "vendor profile" in label_text and i + 1 < len(table.rows):
                next_row = table.rows[i + 1]
                if len(next_row.cells) >= 2:
                    target_cell = next_row.cells[1]
                    vendor_profile = vendor_data.get("vendor_profile_paragraph", "")
                    _set_italic_text(target_cell, vendor_profile)
                break

def _set_cell_value(cell, value):
    """Set cell text value safely."""
    # Clear existing
    for p in cell.paragraphs:
        p.clear()
    # Add new
    if not cell.paragraphs:
        cell.add_paragraph()
    
    cell.paragraphs[0].text = str(value) if value else "N/A"

def _set_italic_text(cell, text):
    """Set text with italic formatting."""
    for p in cell.paragraphs:
        p.clear()
    
    if not cell.paragraphs:
        cell.add_paragraph()
        
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(str(text) if text else "N/A")
    run.italic = True

def _set_news_list(cell, news_list):
    """Populate news items as bullet points."""
    for p in cell.paragraphs:
        p.clear()
        
    if not news_list:
        if not cell.paragraphs: cell.add_paragraph()
        cell.paragraphs[0].text = "No recent news available"
        return

    # Normalize list
    if not isinstance(news_list, list):
        news_list = [news_list]

    # Ensure we have at least one paragraph to start
    if not cell.paragraphs:
        cell.add_paragraph()

    for i, item in enumerate(news_list):
        if i == 0:
            paragraph = cell.paragraphs[0]
        else:
            paragraph = cell.add_paragraph()
        
        # Build text string based on available fields from Claude API
        text = ""
        if isinstance(item, dict):
            date = item.get("date", "")
            headline = item.get("headline", item.get("title", ""))
            summary = item.get("summary", "")
            text = f"{date} - {headline}" if date else headline
            if summary:
                text += f": {summary}"
        else:
            text = str(item)
            
        paragraph.add_run(f"• {text}")
