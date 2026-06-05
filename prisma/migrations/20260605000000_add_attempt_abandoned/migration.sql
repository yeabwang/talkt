-- Mid-call manual end: marks an attempt abandoned so it is never graded
-- (webhook skips it) and stays out of the user's history.
ALTER TYPE "AttemptStatus" ADD VALUE 'abandoned';
