/**
 * InvestmentsTab Component
 * Display current operating costs and facility ROI calculator
 */

import { FinancialReport, formatCurrency } from '../utils/financialApi';
import FacilityROICalculator from './FacilityROICalculator';

interface InvestmentsTabProps {
  report: FinancialReport;
}

function InvestmentsTab({ report }: InvestmentsTabProps) {
  // Calculate monthly costs (daily * 30)
  const monthlyOperatingCosts = report.expenses.operatingCosts * 30;
  const monthlyRepairs = report.expenses.repairs * 30;
  const monthlyTotal = monthlyOperatingCosts + monthlyRepairs;

  return (
    <div className="space-y-6">
      {/* Current Costs Overview */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Current Monthly Costs</h2>
        <p className="text-gray-400 text-sm mb-4">
          Overview of your current daily and monthly expenses.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Monthly Operating Costs</div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(monthlyOperatingCosts)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(report.expenses.operatingCosts)}/day
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Monthly Repairs (Est.)</div>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(monthlyRepairs)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(report.expenses.repairs)}/day
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <div className="text-sm text-gray-400 mb-1">Total Monthly Expenses</div>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(monthlyTotal)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(report.expenses.total)}/day
            </div>
          </div>
        </div>

        {/* Operating Costs Breakdown */}
        {report.expenses.operatingCostsBreakdown.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-3">Facility Costs Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.expenses.operatingCostsBreakdown.map((item) => (
                <div key={item.facilityType} className="flex justify-between p-2 bg-gray-700 rounded text-sm">
                  <span className="text-gray-300">{item.facilityName}</span>
                  <span className="font-semibold text-gray-200">
                    {formatCurrency(item.cost)}/day
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ROI Calculator */}
      <FacilityROICalculator />

      {/* Investment Tips */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">💡 Investment Tips</h2>
        <ul className="space-y-3 text-gray-300">
          <li className="flex items-start">
            <span className="text-green-400 mr-2">•</span>
            <span>
              <strong>Income Generator</strong> provides direct daily income through merchandising and streaming.
              Calculate ROI to see how quickly it pays for itself.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-400 mr-2">•</span>
            <span>
              <strong>Training Facilities</strong> reduce attribute upgrade costs by up to 50%.
              Good long-term investment if you upgrade robots frequently.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-purple-400 mr-2">•</span>
            <span>
              <strong>Repair Bay & Medical Bay</strong> reduce repair costs.
              Worthwhile if you have high repair bills from frequent battles.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-400 mr-2">•</span>
            <span>
              <strong>Training Academies</strong> increase attribute caps, allowing stronger robots.
              Essential for competitive play but no direct cost savings.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-red-400 mr-2">•</span>
            <span>
              <strong>Consider your balance</strong> before major upgrades. 
              The calculator shows affordability and suggests keeping sufficient reserves.
            </span>
          </li>
        </ul>
      </div>

      {/* Note about future features */}
      <div className="bg-blue-900/20 border border-blue-700 text-blue-300 p-4 rounded">
        <h3 className="font-semibold mb-2">🚧 Future Features</h3>
        <p className="text-sm">
          Coming soon: Transaction history tracking, spending trends over time, and investment
          recommendations based on your playing style. For now, use the ROI calculator to make
          informed upgrade decisions.
        </p>
      </div>
    </div>
  );
}

export default InvestmentsTab;
