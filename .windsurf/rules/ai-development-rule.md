---
trigger: always_on
description: Rules specific to AI/ML development in this project.
---

## AI Development Rules

### Model Selection & Usage
- Document reasoning for model choices (cost, performance, capabilities)
- Track model versions and configurations
- Consider fallback options for API failures
- Monitor model performance and quality metrics
- Be aware of rate limits and quotas

### Prompt Engineering
- Version control all prompts in the codebase
- Document prompt design decisions
- Test prompts with various inputs and edge cases
- Track what works and what doesn't
- Consider prompt injection and safety

### Cost Management
- Monitor API usage and costs
- Implement caching where appropriate
- Use cheaper models for simpler tasks
- Set budget alerts and limits
- Document cost implications of changes

### Performance & Reliability
- Implement retry logic with exponential backoff
- Handle rate limiting gracefully
- Cache responses when appropriate
- Monitor latency and throughput
- Plan for API downtime

### Ethical Considerations
- Document potential biases in models
- Consider privacy implications of data processing
- Implement content filtering where needed
- Be transparent about AI limitations
- Follow responsible AI practices

### Experimentation
- Track experiments in `docs/experiments.md`
- Record hypotheses, methods, and results
- Compare different approaches systematically
- Clean up failed experiments
- Integrate successful experiments properly

### Data Handling
- Never log sensitive user data
- Anonymize data where possible
- Follow data retention policies
- Be mindful of PII in prompts and responses
- Implement data validation and sanitization
