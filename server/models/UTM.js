import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
    utm_source: { type: String, required: false },
    utm_medium: { type: String, required: false },
    utm_campaign: { type: String, required: false },
    utm_term: { type: String, required: false },
    utm_content: { type: String, required: false },
  }, { timestamps: true });
  
  const UTM = mongoose.model('UTM', utmSchema);

  export default UTM;