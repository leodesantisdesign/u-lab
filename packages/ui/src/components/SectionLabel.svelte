<script lang="ts">
  interface Props {
    text: string;
  }

  let { text }: Props = $props();
</script>

<p class="section-label">{text}</p>

<style>
  .section-label {
    font-family: var(--font-sans);
    font-size: var(--t-label);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-label);
    color: var(--ink-muted);
    opacity: 0.7;
  }
</style>
