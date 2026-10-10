import mongoose from 'mongoose';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;

console.log('Connecting to', uri);
mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Connected');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error', err);
    process.exit(1);
  });
