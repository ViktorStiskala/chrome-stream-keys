"""Terminal control sequence handling for TUI output.

Command output from PTY contains terminal control sequences that need
different handling depending on the output mode:

- --simple mode: Pass through unchanged (stdout is real terminal)
- TUI mode: Convert ANSI to Rich markup (RichLog uses Rich markup)
- Terminal restoration: Pass through unchanged (printing to real terminal)
"""

import re

# ANSI SGR (Select Graphic Rendition) code to Rich markup mapping
ANSI_TO_RICH: dict[str, str] = {
    # Reset
    "0": "/",
    # Text styles
    "1": "bold",
    "2": "dim",
    "3": "italic",
    "4": "underline",
    "5": "blink",
    "7": "reverse",
    "8": "hidden",
    "9": "strike",
    # Reset styles
    "21": "/bold",  # double underline or bold off (varies)
    "22": "/dim",  # normal intensity (not bold, not dim)
    "23": "/italic",
    "24": "/underline",
    "25": "/blink",
    "27": "/reverse",
    "28": "/hidden",
    "29": "/strike",
    # Foreground colors (30-37)
    "30": "black",
    "31": "red",
    "32": "green",
    "33": "yellow",
    "34": "blue",
    "35": "magenta",
    "36": "cyan",
    "37": "white",
    "39": "default",  # default foreground
    # Background colors (40-47)
    "40": "on black",
    "41": "on red",
    "42": "on green",
    "43": "on yellow",
    "44": "on blue",
    "45": "on magenta",
    "46": "on cyan",
    "47": "on white",
    "49": "on default",  # default background
    # Bright foreground colors (90-97)
    "90": "bright_black",
    "91": "bright_red",
    "92": "bright_green",
    "93": "bright_yellow",
    "94": "bright_blue",
    "95": "bright_magenta",
    "96": "bright_cyan",
    "97": "bright_white",
    # Bright background colors (100-107)
    "100": "on bright_black",
    "101": "on bright_red",
    "102": "on bright_green",
    "103": "on bright_yellow",
    "104": "on bright_blue",
    "105": "on bright_magenta",
    "106": "on bright_cyan",
    "107": "on bright_white",
}

# Pattern for ANSI escape sequences to process/strip
# Note: \r, \n, \b are handled by OutputProcessor.process() as raw characters
# This pattern handles ESC-based sequences:
#   - CSI sequences (ESC [): colors converted, cursor/erase stripped
#   - OSC sequences (ESC ]): stripped (terminal title, etc.)
#   - Other sequences: stripped
ANSI_ALL_PATTERN = re.compile(
    r"\x1B"  # ESC character
    r"(?:"
    r"\[[0-9;:]*[A-Za-z]"  # CSI sequences: ESC [ params letter (includes : for some terminals)
    r"|"
    r"\][^\x07\x1B]*(?:\x07|\x1B\\)?"  # OSC sequences: ESC ] ... BEL or ST
    r"|"
    r"[PX^_][^\x1B]*(?:\x1B\\)?"  # DCS, SOS, PM, APC sequences
    r"|"
    r"[@-Z\\-_]"  # Single character sequences (Fe)
    r")"
)

# Pattern specifically for CSI sequences (to extract params for color conversion)
# CSI sequence: ESC [ <params> <command>
# Command 'm' = SGR (colors/styles) - converted to Rich markup
# Other commands (A-L, J, K, etc.) = cursor/erase - stripped
ANSI_CSI_PATTERN = re.compile(r"\x1B\[([0-9;:]*)([A-Za-z])")


def ansi_to_rich(text: str) -> str:
    """Convert ANSI escape codes to Rich markup.

    Processing:
    - SGR codes (ESC [ ... m): Converted to Rich markup tags
    - Cursor movement (ESC [ A/B/C/D/G/H): Stripped (handled by OutputProcessor)
    - Erase codes (ESC [ J/K): Stripped (handled by OutputProcessor via \\r)
    - OSC/DCS sequences: Stripped (not relevant for display)

    Note: Raw \\r, \\n, \\b are NOT handled here - they are processed
    by OutputProcessor.process() before this function is called.

    Args:
        text: Text with ANSI escape codes

    Returns:
        Text with Rich markup tags (non-color codes stripped)
    """
    result: list[str] = []
    last_end = 0

    for match in ANSI_ALL_PATTERN.finditer(text):
        # Add text before this escape sequence (escaped for Rich)
        result.append(_escape_rich_markup(text[last_end : match.start()]))

        # Try to parse as CSI sequence for color conversion
        seq = match.group(0)
        csi_match = ANSI_CSI_PATTERN.fullmatch(seq)

        if csi_match and csi_match.group(2) == "m":
            # SGR (Select Graphic Rendition) - colors/styles
            params = csi_match.group(1)
            markup = _parse_sgr(params)
            if markup:
                result.append(markup)
        # All other sequences are stripped (cursor movement, erase, etc.)

        last_end = match.end()

    # Add remaining text
    result.append(_escape_rich_markup(text[last_end:]))

    return "".join(result)


def _parse_sgr(params: str) -> str:
    """Parse SGR (Select Graphic Rendition) parameters to Rich markup.

    Handles:
    - Basic colors (30-37, 40-47)
    - Bright colors (90-97, 100-107)
    - 256 color mode (38;5;N and 48;5;N)
    - RGB color mode (38;2;R;G;B and 48;2;R;G;B)
    - Text styles (bold, italic, etc.)

    Args:
        params: Semicolon-separated SGR parameters

    Returns:
        Rich markup string or empty string
    """
    if not params or params == "0":
        return "[/]"

    parts = params.split(";")
    tags: list[str] = []
    i = 0

    while i < len(parts):
        param = parts[i]

        # 256 color foreground: 38;5;N
        if param == "38" and i + 2 < len(parts) and parts[i + 1] == "5":
            try:
                color_num = int(parts[i + 2])
                tags.append(f"[color({color_num})]")
                i += 3
                continue
            except ValueError:
                pass

        # 256 color background: 48;5;N
        if param == "48" and i + 2 < len(parts) and parts[i + 1] == "5":
            try:
                color_num = int(parts[i + 2])
                tags.append(f"[on color({color_num})]")
                i += 3
                continue
            except ValueError:
                pass

        # RGB foreground: 38;2;R;G;B
        if param == "38" and i + 4 < len(parts) and parts[i + 1] == "2":
            try:
                r, g, b = int(parts[i + 2]), int(parts[i + 3]), int(parts[i + 4])
                tags.append(f"[rgb({r},{g},{b})]")
                i += 5
                continue
            except ValueError:
                pass

        # RGB background: 48;2;R;G;B
        if param == "48" and i + 4 < len(parts) and parts[i + 1] == "2":
            try:
                r, g, b = int(parts[i + 2]), int(parts[i + 3]), int(parts[i + 4])
                tags.append(f"[on rgb({r},{g},{b})]")
                i += 5
                continue
            except ValueError:
                pass

        # Basic SGR codes
        if param in ANSI_TO_RICH:
            tag = ANSI_TO_RICH[param]
            if tag == "/":
                tags.append("[/]")
            elif tag.startswith("/"):
                tags.append(f"[{tag}]")
            else:
                tags.append(f"[{tag}]")

        i += 1

    return "".join(tags)


def _escape_rich_markup(text: str) -> str:
    """Escape Rich markup characters in plain text.

    Args:
        text: Plain text that might contain [ or ]

    Returns:
        Text with [ and ] escaped
    """
    # Rich uses [tag] syntax, so escape literal brackets
    return text.replace("[", r"\[").replace("]", r"\]")


class OutputProcessor:
    """Process terminal output for display in Textual RichLog.

    Handles carriage returns and backspaces by simulating line overwrite.
    Converts ANSI color codes to Rich markup for proper rendering.

    This processor is only used in TUI mode. In --simple mode and during
    terminal restoration, output is passed through unchanged.
    """

    def __init__(self) -> None:
        """Initialize the output processor."""
        self.current_line: str = ""

    def process(self, text: str) -> str:
        """Process raw PTY output for RichLog display.

        Handles:
        - \\r (carriage return): Reset to start of current line
        - \\n (newline): Emit current line and reset
        - \\b (backspace): Remove last char from current line
        - ANSI codes: Converted to Rich markup

        Args:
            text: Raw output from PTY

        Returns:
            Processed output suitable for RichLog (completed lines only)
        """
        result_lines: list[str] = []

        i = 0
        while i < len(text):
            char = text[i]

            if char == "\r":
                # Carriage return: reset to start of current line
                # Check for \r\n (Windows-style newline)
                if i + 1 < len(text) and text[i + 1] == "\n":
                    # Treat \r\n as newline
                    result_lines.append(self.current_line)
                    self.current_line = ""
                    i += 2
                    continue
                # Otherwise, just reset to start of line (for progress bars)
                self.current_line = ""
            elif char == "\n":
                # Newline: emit current line and reset
                result_lines.append(self.current_line)
                self.current_line = ""
            elif char == "\b":
                # Backspace: remove last char from current line
                if self.current_line:
                    self.current_line = self.current_line[:-1]
            else:
                self.current_line += char

            i += 1

        # Convert ANSI to Rich markup in completed lines
        if result_lines:
            converted = [ansi_to_rich(line) for line in result_lines]
            return "\n".join(converted) + "\n"
        return ""

    def flush(self) -> str:
        """Flush any remaining partial line.

        Call this when the process ends to get any remaining output
        that hasn't been terminated with a newline.

        Returns:
            Remaining partial line (with newline appended) or empty string
        """
        if self.current_line:
            result = ansi_to_rich(self.current_line) + "\n"
            self.current_line = ""
            return result
        return ""

    def reset(self) -> None:
        """Reset processor state for reuse."""
        self.current_line = ""
