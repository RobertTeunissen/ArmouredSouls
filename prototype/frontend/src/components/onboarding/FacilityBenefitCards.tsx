/**
 * FacilityBenefitCards Component
 * 
 * Displays detailed explanation cards for key facilities with concrete examples
 * showing credit savings and benefits. Helps players understand the value
 * proposition of each facility type.
 * 
 * Requirements: 18.1-18.9
 */

import React, { memo } from 'react';
import FacilityIcon from '../FacilityIcon';

export interface FacilityBenefit {
  type: string;
  name: string;
  description: string;
  discountRange?: string;
  examples: {
    scenario: string;
    withoutFacility: string;
    withFacility: string;
    savings: string;
  }[];
  keyPoints: string[];
  timing: string;
}

interface FacilityBenefitCardsProps {
  className?: string;
}

/**
 * Facility benefit data with concrete examples
 */
const FACILITY_BENEFITS: FacilityBenefit[] = [
  {
    type: 'weapons_workshop',
    name: 'Weapons Workshop',
    description: 'Reduces the cost of purchasing weapons from the weapon shop. Higher levels provide greater discounts.',
    discountRange: '5% (Level 1) to 50% (Level 10)',
    examples: [
      {
        scenario: 'Buying a Laser Rifle (₡275K) at Level 5',
        withoutFacility: '₡275,000',
        withFacility: '₡206,250 (25% discount)',
        savings: '₡68,750 saved',
      },
      {
        scenario: 'Buying a Machine Gun (₡150K) at Level 5',
        withoutFacility: '₡150,000',
        withFacility: '₡112,500 (25% discount)',
        savings: '₡37,500 saved',
      },
      {
        scenario: 'Buying 3 weapons (₡600K total) at Level 10',
        withoutFacility: '₡600,000',
        withFacility: '₡300,000 (50% discount)',
        savings: '₡300,000 saved',
      },
    ],
    keyPoints: [
      'Purchase BEFORE buying weapons to maximize savings',
      'Savings apply to every weapon purchase',
      'Level 5 provides 25% discount (good starting point)',
      'Level 10 provides 50% discount (maximum savings)',
      'Discount compounds with multiple weapon purchases',
    ],
    timing: 'Buy this facility FIRST, before purchasing any weapons from the shop.',
  },
  {
    type: 'training_facility',
    name: 'Training Facility',
    description: 'Reduces the cost of upgrading robot attributes. Essential for all strategies as attribute upgrades are expensive.',
    discountRange: '10% (Level 1) to 90% (Level 10)',
    examples: [
      {
        scenario: 'Upgrading all attributes from 1→5 (₡400K)',
        withoutFacility: '₡400,000',
        withFacility: '₡200,000 (50% discount at Level 5)',
        savings: '₡200,000 saved',
      },
      {
        scenario: 'Upgrading all attributes from 1→10 (₡2.07M)',
        withoutFacility: '₡2,070,000',
        withFacility: '₡207,000 (90% discount at Level 10)',
        savings: '₡1,863,000 saved',
      },
      {
        scenario: 'Single attribute upgrade 5→6 (₡60K)',
        withoutFacility: '₡60,000',
        withFacility: '₡30,000 (50% discount at Level 5)',
        savings: '₡30,000 saved',
      },
    ],
    keyPoints: [
      'Purchase BEFORE upgrading attributes',
      'Savings compound dramatically over time',
      'Level 5 provides 50% discount (recommended minimum)',
      'Level 10 provides 90% discount (massive savings)',
      'Essential for all strategies (1, 2, or 3 robots)',
    ],
    timing: 'Buy this facility BEFORE upgrading any robot attributes.',
  },
  {
    type: 'roster_expansion',
    name: 'Roster Expansion',
    description: 'Increases the maximum number of robots you can own. Required for 2-robot and 3-robot strategies.',
    examples: [
      {
        scenario: 'Level 1 (2-robot strategy)',
        withoutFacility: 'Can only create 1 robot',
        withFacility: 'Can create up to 2 robots',
        savings: 'Unlocks 2nd robot slot',
      },
      {
        scenario: 'Level 2 (3-robot strategy)',
        withoutFacility: 'Can only create 2 robots',
        withFacility: 'Can create up to 3 robots',
        savings: 'Unlocks 3rd robot slot',
      },
    ],
    keyPoints: [
      'REQUIRED before creating 2nd or 3rd robot',
      'Level 1 costs ₡150K (allows 2 robots)',
      'Level 2 costs ₡450K total (allows 3 robots)',
      'Cannot create additional robots without this facility',
      'Not needed for 1-robot strategy',
    ],
    timing: 'Buy this facility BEFORE attempting to create your 2nd or 3rd robot.',
  },
  {
    type: 'storage_facility',
    name: 'Storage Facility',
    description: 'Increases weapon storage capacity. Base capacity is 5 weapons, each level adds +5 capacity.',
    examples: [
      {
        scenario: 'Base storage (no facility)',
        withoutFacility: '5 weapons maximum',
        withFacility: 'N/A',
        savings: 'Limited weapon variety',
      },
      {
        scenario: 'Level 1 Storage Facility',
        withoutFacility: '5 weapons maximum',
        withFacility: '10 weapons maximum',
        savings: '+5 weapon slots',
      },
      {
        scenario: 'Level 2 Storage Facility',
        withoutFacility: '5 weapons maximum',
        withFacility: '15 weapons maximum',
        savings: '+10 weapon slots',
      },
    ],
    keyPoints: [
      'Base capacity: 5 weapons (no facility)',
      'Each level adds +5 weapon slots',
      'Important for 3-robot strategies (need 3-6 weapons)',
      'Prevents "storage full" errors when buying weapons',
      'Level 1 costs ₡100K',
    ],
    timing: 'Buy before purchasing multiple weapons, especially for 3-robot strategies.',
  },
  {
    type: 'repair_bay',
    name: 'Repair Bay',
    description: 'Reduces the cost of repairing damaged robots after battles. More valuable if you lose battles frequently.',
    discountRange: '5% (Level 1) to 55% (Level 10)',
    examples: [
      {
        scenario: 'Repairing 50% damage (₡100K repair)',
        withoutFacility: '₡100,000',
        withFacility: '₡72,500 (27.5% discount at Level 5)',
        savings: '₡27,500 saved per repair',
      },
      {
        scenario: 'Repairing 80% damage (₡160K repair)',
        withoutFacility: '₡160,000',
        withFacility: '₡116,000 (27.5% discount at Level 5)',
        savings: '₡44,000 saved per repair',
      },
      {
        scenario: '10 repairs over time (₡1M total)',
        withoutFacility: '₡1,000,000',
        withFacility: '₡450,000 (55% discount at Level 10)',
        savings: '₡550,000 saved',
      },
    ],
    keyPoints: [
      'Reduces ongoing repair costs',
      'More valuable if you lose battles frequently',
      'Level 5 provides ~27.5% discount',
      'Level 10 provides 55% discount',
      'Savings accumulate over many battles',
    ],
    timing: 'Optional. Consider after essential facilities if you have budget remaining.',
  },
];

const FacilityBenefitCards: React.FC<FacilityBenefitCardsProps> = memo(({ className = '' }) => {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="text-blue-400 font-semibold mb-1">
              Understanding Facility Value
            </h3>
            <p className="text-blue-200 text-sm">
              These examples show real credit savings. Discount facilities (Weapons Workshop, Training Facility) 
              provide the best return on investment when purchased early.
            </p>
          </div>
        </div>
      </div>

      {FACILITY_BENEFITS.map((facility) => (
        <div
          key={facility.type}
          className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-all"
        >
          {/* Header */}
          <div className="bg-gray-750 border-b border-gray-700 p-4">
            <div className="flex items-center gap-4">
              <FacilityIcon facilityType={facility.type} facilityName={facility.name} size="large" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-100 mb-1">{facility.name}</h3>
                {facility.discountRange && (
                  <p className="text-sm text-green-400 font-medium">
                    Discount: {facility.discountRange}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Description */}
            <p className="text-gray-300">{facility.description}</p>

            {/* Examples */}
            <div>
              <h4 className="text-lg font-semibold text-gray-100 mb-3">Concrete Examples</h4>
              <div className="space-y-3">
                {facility.examples.map((example, index) => (
                  <div
                    key={index}
                    className="bg-gray-750 border border-gray-700 rounded-lg p-4"
                  >
                    <h5 className="font-semibold text-gray-200 mb-3">{example.scenario}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Without Facility</div>
                        <div className="text-red-400 font-semibold">{example.withoutFacility}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">With Facility</div>
                        <div className="text-green-400 font-semibold">{example.withFacility}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Savings</div>
                        <div className="text-yellow-400 font-bold">{example.savings}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Points */}
            <div>
              <h4 className="text-lg font-semibold text-gray-100 mb-2">Key Points</h4>
              <ul className="space-y-2">
                {facility.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timing */}
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 text-lg">⏰</span>
                <div>
                  <h5 className="text-yellow-400 font-semibold text-sm mb-1">When to Purchase</h5>
                  <p className="text-yellow-200 text-sm">{facility.timing}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">Facility Purchase Strategy</h3>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start gap-3">
            <span className="text-2xl">1️⃣</span>
            <div>
              <p className="font-semibold text-gray-100">Discount Facilities First</p>
              <p>Weapons Workshop and Training Facility provide immediate savings on future purchases.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">2️⃣</span>
            <div>
              <p className="font-semibold text-gray-100">Roster Expansion (If Needed)</p>
              <p>Required for 2-robot or 3-robot strategies before creating additional robots.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">3️⃣</span>
            <div>
              <p className="font-semibold text-gray-100">Storage Facility (For 3-Robot Strategy)</p>
              <p>Prevents weapon storage issues when managing multiple robots.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">4️⃣</span>
            <div>
              <p className="font-semibold text-gray-100">Optional Facilities</p>
              <p>Repair Bay, Training Academies, and passive income facilities based on remaining budget.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

FacilityBenefitCards.displayName = 'FacilityBenefitCards';

export default FacilityBenefitCards;
