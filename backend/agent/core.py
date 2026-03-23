"""
LangGraph agent core — orchestrates Claude with Vidalytics tools and knowledge retrieval.
Supports streaming responses via async generator.
"""

import logging
from typing import AsyncGenerator

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from .tools import get_vidalytics_tools, set_vidalytics_token
from .knowledge import get_knowledge_tools
from .prompts import SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _extract_text_from_content(content) -> str:
    """Extract text from a chunk's content, which may be str, list of blocks, or other."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return ""


def build_agent(anthropic_api_key: str):
    """Create a LangGraph ReAct agent with Claude and all tools."""
    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        anthropic_api_key=anthropic_api_key,
        max_tokens=4096,
        temperature=0.3,
    )

    all_tools = get_vidalytics_tools() + get_knowledge_tools()

    agent = create_react_agent(
        model=llm,
        tools=all_tools,
    )

    return agent


def _build_messages(conversation_history: list[dict], new_message: str) -> list:
    """Convert conversation history + new message into LangChain message objects."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)]

    for msg in conversation_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=new_message))
    return messages


async def run_agent_stream(
    anthropic_api_key: str,
    vidalytics_token: str,
    message: str,
    conversation_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Run the agent and stream text chunks as they are produced."""
    set_vidalytics_token(vidalytics_token)

    agent = build_agent(anthropic_api_key)
    messages = _build_messages(conversation_history or [], message)

    config = {"recursion_limit": 50}

    full_response = ""
    last_yielded = 0

    try:
        async for event in agent.astream_events(
            {"messages": messages},
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")

            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content"):
                    text = _extract_text_from_content(chunk.content)
                    if text:
                        full_response += text
                        new_text = full_response[last_yielded:]
                        if new_text:
                            yield new_text
                            last_yielded = len(full_response)

            elif kind == "on_chat_model_end":
                output = event.get("data", {}).get("output")
                if output and hasattr(output, "content"):
                    text = _extract_text_from_content(output.content)
                    if text and text not in full_response:
                        new_part = text[len(full_response):] if text.startswith(full_response) else text
                        if new_part and new_part.strip():
                            full_response += new_part
                            yield new_part

            elif kind == "on_tool_start":
                tool_name = event.get("name", "unknown")
                yield f"\n\n_Sto usando il tool `{tool_name}`..._\n\n"

    except Exception as e:
        logger.error("Agent stream error: %s", e, exc_info=True)
        yield f"\n\n**Errore durante l'analisi:** {str(e)}"
        return

    if not full_response.strip():
        logger.warning("Agent produced no text response for message: %s", message[:100])
        yield "Non sono riuscito a generare una risposta. Riprova."


async def run_agent(
    anthropic_api_key: str,
    vidalytics_token: str,
    message: str,
    conversation_history: list[dict] | None = None,
) -> str:
    """Run the agent and return the full response (non-streaming)."""
    set_vidalytics_token(vidalytics_token)

    agent = build_agent(anthropic_api_key)
    messages = _build_messages(conversation_history or [], message)

    config = {"recursion_limit": 50}
    result = await agent.ainvoke({"messages": messages}, config=config)

    ai_messages = [m for m in result["messages"] if isinstance(m, AIMessage)]
    if ai_messages:
        last = ai_messages[-1]
        text = _extract_text_from_content(last.content)
        if text:
            return text
    return "Non sono riuscito a generare una risposta."
