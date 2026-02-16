from flask import Flask, request, send_file, jsonify
from services.word_generator import generate_vendor_profile
import os

app = Flask(__name__)

@app.route('/generate-document', methods=['POST'])
def generate_document():
    """
    Expects JSON:
    {
      "client_name": "Acme Corp",
      "vendor_name": "TechVendor Inc",
      "deal_description": "3-year software license",
      "research_data": { ... } // Claude API response
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        client_name = data.get('client_name')
        vendor_name = data.get('vendor_name')
        research_data = data.get('research_data')
        
        if not client_name or not vendor_name or not research_data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Generate Word doc
        # Note: deal_description is optional
        output_path = generate_vendor_profile(
            client_name=client_name,
            vendor_name=vendor_name,
            deal_description=data.get('deal_description', ''),
            research_data=research_data
        )
        
        # Return file
        # In production, we might upload to S3 and return URL, 
        # but for V1 we return the file stream.
        return send_file(
            output_path,
            as_attachment=True,
            download_name=f"{client_name}_{vendor_name}_MOA.docx"
        )
    except Exception as e:
        app.logger.error(f"Error generating document: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
