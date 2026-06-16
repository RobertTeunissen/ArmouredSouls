#!/bin/bash

# Install testing dependencies for AdminPage tests
echo "Installing testing dependencies..."
pnpm add --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

echo ""
echo "Dependencies installed successfully!"
echo ""
echo "Now you can run tests with:"
echo "  pnpm run test"
echo "  pnpm run test:coverage"
echo "  pnpm run test:ui"
