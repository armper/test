import ConditionAlertsPanel from '../components/ConditionAlertsPanel';

const CustomAlertsPage = () => (
  <div className="page-section">
    <div className="section-header">
      <div>
        <h2>Custom Condition Alerts</h2>
        <p>Create everyday reminders for hot, cold, rainy, and windy days.</p>
      </div>
    </div>
    <ConditionAlertsPanel />
  </div>
);

export default CustomAlertsPage;
