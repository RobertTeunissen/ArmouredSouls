#!/bin/bash

# Install testing dependencies for AdminPage tests
echo "Installing testing dependencies..."
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

echo ""
echo "Dependencies installed successfully!"
echo ""
echo "Now you can run tests with:"
echo "  npm run test"
echo "  npm run test:coverage"
echo "  npm run test:ui"
