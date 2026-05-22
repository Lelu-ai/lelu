export default function DocsPredictiveAnalytics() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Advanced Features
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Predictive Analytics
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          AI-powered predictions for confidence scores, human review needs, and policy optimization
          suggestions based on historical patterns and machine learning models.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Overview</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Predictive analytics uses machine learning models trained on historical authorization
            data to forecast agent behavior, identify potential issues before they occur, and
            suggest policy improvements. Models are automatically retrained every 6 hours to adapt
            to changing patterns.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Confidence Prediction
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Forecast confidence scores for new requests based on agent history.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
              <div className="text-2xl mb-2">👁️</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Review Prediction</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Identify which actions will likely need human review.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Policy Optimization
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Suggest improvements to underperforming policies.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Confidence Score Prediction
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Predict what confidence score an agent will report for a new request based on historical
            patterns, temporal features, and context.
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Prediction Features</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Historical Confidence
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Agent's average confidence over past 30 days
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Action Frequency
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    How often the agent performs this action
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Temporal Patterns
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Time of day and day of week effects
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Recent Error Rate
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Agent's recent authorization failures
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`import { createClient } from 'lelu-agent-auth';

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

// Predict confidence score for a new request
const prediction = await lelu.predictConfidence({
  agentId: 'support-agent',
  action: 'refund:process',
});

console.log('Predicted confidence:', prediction.predictedConfidence);
console.log('Model accuracy:', prediction.modelAccuracy);
console.log('Features used:', prediction.features);

// Example output:
// {
//   agentId: 'support-agent',
//   action: 'refund:process',
//   predictedConfidence: 0.82,
//   modelAccuracy: 0.89,
//   features: {
//     historical_confidence: 0.85,
//     action_frequency: 0.65,
//     hour_of_day: 0.58,
//     recent_error_rate: 0.05
//   },
//   timestamp: '2026-03-21T10:30:00Z'
// }`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Human Review Prediction
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Predict whether an action will need human review based on confidence scores, risk
            factors, and historical review patterns. This helps prioritize review queues and
            allocate human resources efficiently.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Predict if human review will be needed
const reviewPrediction = await lelu.predictHumanReview({
  agentId: 'support-agent',
  action: 'refund:process',
  confidence: 0.75,
});

console.log('Needs review:', reviewPrediction.needsReview);
console.log('Review probability:', reviewPrediction.reviewProbability);
console.log('Risk factors:', reviewPrediction.riskFactors);

// Example output:
// {
//   agentId: 'support-agent',
//   action: 'refund:process',
//   needsReview: true,
//   reviewProbability: 0.72,
//   confidence: 0.75,
//   riskFactors: [
//     'Low confidence score',
//     'High-risk action type',
//     'Agent frequently requires review'
//   ],
//   features: {
//     confidence: 0.75,
//     action_risk_score: 0.85,
//     historical_review_rate: 0.45
//   },
//   timestamp: '2026-03-21T10:30:00Z'
// }`}</code>
              </pre>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4 flex gap-3 mb-6">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Review predictions use logistic regression with precision and recall metrics tracked
              for model quality.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Policy Optimization
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Analyze policy effectiveness and receive actionable suggestions for improving
            underperforming policies. The system tracks success rates, latency, and overall
            effectiveness for each policy.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Get policy optimization suggestions
const suggestions = await lelu.getPolicyOptimizations();

suggestions.forEach(suggestion => {
  console.log(\`Policy: \${suggestion.policyName}\`);
  console.log(\`Current score: \${suggestion.currentScore}\`);
  console.log(\`Priority: \${suggestion.priority}\`);
  console.log(\`Suggestion: \${suggestion.suggestion}\`);
  console.log(\`Expected impact: +\${suggestion.expectedImpact * 100}%\`);
  console.log(\`Rationale: \${suggestion.rationale}\`);
  console.log('---');
});

// Example output:
// Policy: refund-approval-policy
// Current score: 0.42
// Priority: high
// Suggestion: Policy is rejecting too many valid requests
// Expected impact: +30%
// Rationale: Success rate is only 42.0%, consider relaxing constraints
// ---
// Policy: high-value-transaction-policy
// Current score: 0.48
// Priority: medium
// Suggestion: Policy evaluation is slow
// Expected impact: +20%
// Rationale: Average latency is 125.3ms, consider optimizing rules`}</code>
              </pre>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-3">
                Optimization Metrics
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Effectiveness Score</span>
                  <span className="text-zinc-900 dark:text-white font-medium">0-1 scale</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Success Rate</span>
                  <span className="text-zinc-900 dark:text-white font-medium">
                    % of allowed requests
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Average Latency</span>
                  <span className="text-zinc-900 dark:text-white font-medium">Milliseconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Total Decisions</span>
                  <span className="text-zinc-900 dark:text-white font-medium">Count</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Model Training
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Predictive models are automatically trained and updated every 6 hours using the latest
            authorization data. Models require a minimum of 100 samples before making predictions.
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">
              Training Configuration
            </h3>
            <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-300">
              <pre>{`# Model parameters
CONFIDENCE_MODEL_WINDOW=30d        # Historical data window
REVIEW_MODEL_WINDOW=14d            # Review prediction window
MIN_SAMPLES_FOR_MODEL=100          # Minimum training samples

# Prediction thresholds
CONFIDENCE_PREDICTION_THRESHOLD=0.7
REVIEW_PREDICTION_THRESHOLD=0.6
POLICY_OPTIMIZATION_THRESHOLD=0.5

# Update frequency
MODEL_UPDATE_INTERVAL=6h           # Retrain every 6 hours
PREDICTION_CACHE_TIME=15m          # Cache predictions

# Feature engineering
ENABLE_TEMPORAL_FEATURES=true
ENABLE_CONTEXT_FEATURES=true
ENABLE_HISTORICAL_FEATURES=true`}</pre>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-3">Model Types</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Confidence Prediction
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Linear regression model with feature engineering
                  </div>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Human Review Prediction
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Logistic regression with precision/recall optimization
                  </div>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Policy Optimization
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Statistical analysis with rule-based suggestions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Monitoring Model Performance
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Track model accuracy, prediction latency, and prediction counts with Prometheus metrics.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">prometheus metrics</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`# Model accuracy (0-1)
ai_agent_prediction_accuracy{model_type, agent_id}

# Prediction latency
ai_agent_prediction_latency_seconds{model_type}

# Prediction counts
ai_agent_predictions_total{model_type, outcome}

# Model training metrics
ai_agent_model_training_duration_seconds{model_type}
ai_agent_model_sample_count{model_type}
ai_agent_model_last_trained_timestamp{model_type}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Use Cases</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Proactive Review Allocation
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Predict which requests will need human review and allocate reviewers in advance,
                reducing wait times.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Agent Training Insights
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Identify agents with consistently low predicted confidence and provide targeted
                training.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Policy Tuning</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Use optimization suggestions to improve policy effectiveness and reduce false
                denials.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Capacity Planning</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Forecast review workload to plan human reviewer capacity and avoid bottlenecks.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Best Practices
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Ensure Sufficient Training Data
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Models need at least 100 samples per agent to make accurate predictions. New agents
                may have unreliable predictions initially.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Monitor Model Accuracy
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track prediction accuracy metrics and retrain models if accuracy drops below
                acceptable thresholds.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Act on Optimization Suggestions
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Review and implement policy optimization suggestions regularly to maintain system
                effectiveness.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Validate Predictions
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Compare predictions against actual outcomes to validate model performance and
                identify drift.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/prompt-injection"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Prompt Injection Detection
        </a>
        <a
          href="/docs/quickstart"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Back to Getting Started
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
