use std::{
    env, fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Local};
use clap::ValueEnum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum, Default)]
pub enum SortMode {
    #[default]
    Session,
    Recent,
}

impl SortMode {
    pub fn label(self) -> &'static str {
        match self {
            Self::Session => "Session",
            Self::Recent => "Recent activity",
        }
    }

    fn path() -> Option<PathBuf> {
        env::var_os("XDG_CONFIG_HOME")
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|p| PathBuf::from(p).join(".config")))
            .map(|p| p.join("tmux-jump/sort"))
    }

    pub fn load() -> Self {
        Self::path()
            .and_then(|p| fs::read_to_string(p).ok())
            .filter(|s| s.trim() == "recent")
            .map(|_| Self::Recent)
            .unwrap_or_default()
    }

    pub fn save(self) -> Result<()> {
        let Some(path) = Self::path() else {
            bail!("No configuration directory")
        };
        fs::create_dir_all(path.parent().unwrap())?;
        // Separate popups can save concurrently without leaving a partial file.
        let temp = path.with_extension(format!("{}.tmp", std::process::id()));
        fs::write(
            &temp,
            if self == Self::Recent {
                "recent\n"
            } else {
                "session\n"
            },
        )?;
        fs::rename(&temp, path)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeSource {
    Conversation,
    Terminal,
}

#[derive(Debug, Clone, Copy)]
pub struct ActivityTime {
    pub at_ms: Option<i64>,
    pub source: TimeSource,
}

impl ActivityTime {
    pub fn terminal(seconds: Option<i64>) -> Self {
        Self {
            at_ms: seconds.filter(|s| *s > 0).and_then(|s| s.checked_mul(1000)),
            source: TimeSource::Terminal,
        }
    }

    pub fn label(self) -> String {
        let relative = relative_time(self.at_ms, now_ms());
        if self.source == TimeSource::Terminal && self.at_ms.is_some() {
            format!("~{relative}")
        } else {
            relative
        }
    }

    pub fn detail(self) -> String {
        let source = match self.source {
            TimeSource::Conversation => "conversation",
            TimeSource::Terminal => "terminal activity",
        };
        match self.at_ms.and_then(DateTime::from_timestamp_millis) {
            Some(t) => format!(
                "{} · {} ({source})",
                t.with_timezone(&Local).format("%Y-%m-%d %H:%M:%S %:z"),
                self.label()
            ),
            None => format!("Unknown ({source})"),
        }
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// Same thresholds as T-MAX's relativeTimeLabel, including future clock skew.
pub fn relative_time(at_ms: Option<i64>, now: i64) -> String {
    let Some(at) = at_ms.filter(|t| *t > 0) else {
        return "—".into();
    };
    let future = at > now;
    let seconds = ((now as i128 - at as i128).abs() + 500) / 1000;
    if seconds < 45 {
        return if future { "soon" } else { "now" }.into();
    }
    for (label, size) in [("d", 86400), ("h", 3600), ("m", 60)] {
        if seconds >= size {
            let count = seconds / size;
            return if future {
                format!("in {count}{label}")
            } else {
                format!("{count}{label} ago")
            };
        }
    }
    if future { "in 1m" } else { "1m ago" }.into()
}

#[derive(Debug, Serialize)]
pub struct PaneRequest {
    pub pane_id: String,
    pub pid: u32,
    pub cwd: String,
    pub command: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct TimeRecord {
    pub pane_id: String,
    pub pid: u32,
    pub at_ms: Option<i64>,
    pub source: TimeSource,
}

#[derive(Deserialize)]
struct Message {
    record: Option<TimeRecord>,
    #[serde(default)]
    done: bool,
    error: Option<String>,
}

pub struct ActivityReader {
    child: Child,
    rx: Receiver<Result<Message, String>>,
    started: Option<Instant>,
}

fn tmax_dir() -> PathBuf {
    if let Some(path) = env::var_os("TMUX_JUMP_TMAX_DIR") {
        return path.into();
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tmux-mobile")
}

impl ActivityReader {
    pub fn start() -> Result<Self> {
        let executable = env::current_exe()?;
        let bin_dir = executable.parent().context("binary directory missing")?;
        let bundle = env::var_os("TMUX_JUMP_ACTIVITY_HELPER")
            .map(PathBuf::from)
            .or_else(|| {
                if env::var_os("TMUX_JUMP_TMAX_DIR").is_some() {
                    return None;
                }
                [
                    bin_dir.join("../lib/tmux-jump/tmax-activity.cjs"),
                    bin_dir.join("tmax-activity.cjs"),
                ]
                .into_iter()
                .find(|p| p.is_file())
            });
        let mut command = Command::new("node");
        let root = tmax_dir();
        if let Some(bundle) = bundle {
            command.arg(bundle).env("TMUX_JUMP_ACTIVITY_BUNDLED", "1");
        } else {
            if !root.join("lib/backend.mjs").is_file() {
                bail!("Install the activity helper or set TMUX_JUMP_TMAX_DIR")
            }
            command.args([
                "--input-type=module",
                "-e",
                // Keep agent names in the embedded source out of `ps` argv;
                // otherwise T-MAX could mistake this reader for an agent.
                "await import('data:text/javascript,' + encodeURIComponent(process.env.TMUX_JUMP_ACTIVITY_MODULE))",
            ])
            .arg(root)
            .env("TMUX_JUMP_ACTIVITY_MODULE", include_str!("../scripts/tmax-activity.mjs"))
            .env("TMUX_JUMP_ACTIVITY_WORKER", "1");
        }
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .context("start T-MAX activity reader")?;
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let message = line
                    .map_err(|e| e.to_string())
                    .and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()));
                if tx.send(message).is_err() {
                    break;
                }
            }
            let _ = tx.send(Err("T-MAX activity reader stopped".into()));
        });
        Ok(Self {
            child,
            rx,
            started: None,
        })
    }

    pub fn request(&mut self, panes: &[PaneRequest]) -> Result<()> {
        if self.started.is_some() {
            return Ok(());
        }
        let stdin = self
            .child
            .stdin
            .as_mut()
            .context("activity reader stdin closed")?;
        serde_json::to_writer(&mut *stdin, panes)?;
        stdin.write_all(b"\n")?;
        self.started = Some(Instant::now());
        Ok(())
    }

    pub fn busy(&self) -> bool {
        self.started.is_some()
    }

    pub fn poll(&mut self) -> Result<Vec<TimeRecord>> {
        let mut records = Vec::new();
        for message in self.rx.try_iter() {
            let message = message.map_err(anyhow::Error::msg)?;
            if let Some(error) = message.error {
                bail!("{error}")
            }
            if let Some(record) = message.record {
                records.push(record);
            }
            if message.done {
                self.started = None;
            }
        }
        if self
            .started
            .is_some_and(|at| at.elapsed() > Duration::from_secs(30))
        {
            bail!("T-MAX activity lookup timed out")
        }
        Ok(records)
    }
}

impl Drop for ActivityReader {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relative_times_match_tmax_thresholds_and_handle_missing_and_future() {
        let now = 1_000_000_000;
        for (age, expected) in [
            (0, "now"),
            (44_000, "now"),
            (45_000, "1m ago"),
            (120_000, "2m ago"),
            (3_600_000, "1h ago"),
            (86_400_000, "1d ago"),
            (-120_000, "in 2m"),
            (-1_000, "soon"),
        ] {
            assert_eq!(relative_time(Some(now - age), now), expected);
        }
        assert_eq!(relative_time(None, now), "—");
        assert_eq!(relative_time(Some(0), now), "—");
    }
}
