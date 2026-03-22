"""
Pipeline entry point. Runs all steps sequentially unless --step is specified.

Usage:
  python run.py                  # run all steps
  python run.py --step prices    # only fetch prices
  python run.py --step returns   # only compute returns
  python run.py --step var       # only compute VAR / IRFs (resumable)
  python run.py --step diagnose  # report missing influence_edges pairs
"""

import argparse

import fetch_prices
import compute_returns
import compute_var


STEPS = {
    "prices": fetch_prices.run,
    "returns": compute_returns.run,
    "var": compute_var.run,
    "diagnose": compute_var.diagnose,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="S&P 500 stock simulator data pipeline")
    parser.add_argument(
        "--step",
        choices=list(STEPS.keys()),
        default=None,
        help="Run a single pipeline step instead of all steps.",
    )
    args = parser.parse_args()

    if args.step:
        STEPS[args.step]()
    else:
        for name, fn in STEPS.items():
            print(f"\n{'='*60}")
            print(f"Running step: {name}")
            print(f"{'='*60}")
            fn()

    print("Pipeline finished.")


if __name__ == "__main__":
    main()
