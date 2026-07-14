import Joi from "joi";

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().min(5).max(1000).required(),
  price: Joi.number().positive().required(),
  image: Joi.string().uri().required(),
  category: Joi.string().trim().min(2).max(50).required(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().min(5).max(1000),
  price: Joi.number().positive(),
  image: Joi.string().uri(),
  category: Joi.string().trim().min(2).max(50),
}).min(1);
