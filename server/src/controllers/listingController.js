import Joi from 'joi';
import { Listing } from '../models/Listing.js';

const listingFields = {
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn'),
  status: Joi.string().valid('active', 'sold', 'removed'),
  seller: Joi.string().hex().length(24)
};

const createSchema = Joi.object(listingFields);
const updateSchema = Joi.object({
  ...listingFields,
  title: listingFields.title.optional(),
  price: listingFields.price.optional()
}).min(1);

function includeRemoved(req) {
  return req.query.includeRemoved === 'true';
}

function populateSeller(query) {
  return query.populate('seller', 'name email');
}

// GET /api/listings
export async function getAllListings(req, res, next) {
  try {
    const filter = includeRemoved(req) ? {} : { status: { $ne: 'removed' } };
    const listings = await populateSeller(
      Listing.find(filter).sort({ createdAt: -1 })
    ).lean();
    res.json({ listings });
  } catch (err) { next(err); }
}

// GET /api/listings/:id
export async function getListing(req, res, next) {
  try {
    const filter = { _id: req.params.id };
    if (!includeRemoved(req)) filter.status = { $ne: 'removed' };

    const listing = await populateSeller(Listing.findOne(filter));
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json({ listing });
  } catch (err) { next(err); }
}

// POST /api/listings
export async function createListing(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.create(value);
    await listing.populate('seller', 'name email');
    res.status(201).json({ listing });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id
export async function updateListing(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    await listing.populate('seller', 'name email');
    res.json({ listing });
  } catch (err) { next(err); }
}

// DELETE /api/listings/:id
export async function deleteListing(req, res, next) {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'removed' } },
      { new: true, runValidators: true }
    );
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    await listing.populate('seller', 'name email');
    res.json({ listing });
  } catch (err) { next(err); }
}
