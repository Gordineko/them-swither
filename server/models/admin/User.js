import mongoose from 'mongoose';
import bcrypt from "bcrypt";

const SALT_WORK_FACTOR = 10;

const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema({
    area: { type: String },
    city: { type: String },
    warehouse: { type: String },
    products: [
        {
            type: mongoose.Schema.Types.Mixed, default: {}
        }
    ],
    totalCost: { type: Number, },
    status: { type: String },
    order_number: { type: String },
    number_phone: { type: String }
}, {
    strict: false      // <-- все незадекларированные поля тоже сохранятся
});

const userSchema = new mongoose.Schema({
    number_phone: {
        name: { type: String, default: "" },
        title: { type: String, default: "Номер телефону" } // необязательное поле для заголовка или описания
    },
    firstname: {
        name: { type: String, default: "" },
        title: { type: String, default: "Ім'я" } // необязательное поле для заголовка или описания
    },
    lastname: {
        name: { type: String, default: "" },
        title: { type: String, default: "Прізвище" } // необязательное поле для заголовка или описания
    },
    email: {
        name: { type: String, default: "" },
        title: { type: String, default: "EMAIL" } // необязательное поле для заголовка или описания
    },
    password: {
        name: { type: String, default: "" },
        title: { type: String, default: "Пароль" } // необязательное поле для заголовка или описания
    },
    city: {
        name: { type: String, default: "" },
        title: { type: String, default: "Місто" } // необязательное поле для заголовка или описания
    },
    warehouse: {
        name: { type: String, default: "" },
        title: { type: String, default: "Відділення пошти" } // необязательное поле для заголовка или описания
    },
    cart: [cartItemSchema],
    orders: [orderSchema],
    deliveryInfo: {
        area: String,
        city: String,
        warehouse: String,
    },
    promoCodes: [
        {
            title: { type: String }, // Код промокода
            discount: { type: Number },
            validUntil: { type: Date, default: Date.now },
            quantity: { type: Number },
        }
    ],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }]
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    const user = this;
    if (!user.isModified("password")) return next();

    try {
        const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
        const hash = await bcrypt.hash(user.password, salt);
        user.password = hash;
        next();
    } catch (err) {
        next(err);
    }
});

// Метод для сравнения пароля (при аутентификации)
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
export const Order = mongoose.model('Order', orderSchema)
