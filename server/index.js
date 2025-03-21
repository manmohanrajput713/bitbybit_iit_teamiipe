import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();

// Configure CORS to accept requests from your frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'
     ], // Vite dev and preview ports
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.VITE_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create order endpoint
app.post('/api/create-order', async (req, res) => {
  try {
    let { amount, currency } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    if(!currency){
      return res.status(400).json({ error: 'currency is required' });
    }

    // Convert amount to smallest currency unit (paise for INR, cents for USD, etc.)
    const orderAmount = Math.round(Number(amount)*100);
    
    if (isNaN(orderAmount)) {
      return res.status(400).json({ error: 'Invalid amount format' });
    }

    const options = {
      amount: orderAmount,
      currency,
      receipt: 'receipt_' + Date.now(),
    };

    console.log('Creating order with options:', options);

    const order = await razorpay.orders.create(options);
    console.log('Order created:', order);
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      details: error.message 
    });
  }
});

// Verify payment signature
app.post('/api/verify-payment', (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});