export const authStyles = `
  :host {
    display: grid;
    gap: var(--space-6);
  }

  .head {
    display: grid;
    gap: var(--space-2);
  }

  .head h1 {
    font-size: var(--text-2xl);
    font-stretch: 115%;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .head p {
    color: var(--ink-2);
  }

  form {
    display: grid;
    gap: var(--space-4);
  }

  .foot {
    color: var(--ink-2);
    font-size: var(--text-sm);
    text-align: center;
  }

  .foot a,
  .inline-link {
    color: var(--info);
    font-weight: 550;
    text-decoration: none;
  }

  .foot a:hover,
  .inline-link:hover {
    text-decoration: underline;
  }

  .password {
    position: relative;
  }

  .password .input {
    padding-right: 3rem;
  }

  .password button {
    position: absolute;
    top: 50%;
    right: 0.25rem;
    transform: translateY(-50%);
  }

  .names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .result {
    display: grid;
    justify-items: start;
    gap: var(--space-4);
  }

  .result__icon {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--up-soft);
    color: var(--up);
  }

  .result__icon.is-bad {
    background: var(--down-soft);
    color: var(--down);
  }

  .result__icon.is-info {
    background: var(--info-soft);
    color: var(--info);
  }
`;
