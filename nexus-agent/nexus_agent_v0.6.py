import os
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, ToolMessage

os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY", "your_key_here")

# Define a tool with better schema
@tool
def calculate_care(action: str) -> str:
    """
    Calculate CARE currency earned or spent based on an action.
    
    Args:
        action: The action performed (e.g., 'self_care', 'help_others', 'complete_quest')
    
    Returns:
        A message showing CARE earned or spent
    """
    care_values = {
        "self_care": 10,
        "help_others": 15,
        "complete_quest": 25,
        "feed_dragon": 5,
        "rest": 8,
        "buy_egg": -50,
        "unlock_story": -20
    }
    
    action_lower = action.lower().replace(" ", "_")
    
    if action_lower in care_values:
        value = care_values[action_lower]
        if value > 0:
            return f"Action '{action}' earns +{value} CARE"
        else:
            return f"Action '{action}' costs {abs(value)} CARE"
    else:
        return f"Unknown action '{action}'. Known actions: {', '.join(care_values.keys())}"

# Try with llama-3.3-70b-versatile - one of Groq's newest models with tool support
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
llm_with_tools = llm.bind_tools([calculate_care])

print("=" * 40)
print("NEXUS AGENT v0.6 (with CARE tool)")
print("Type 'quit' to exit")
print("=" * 40)

while True:
    user_input = input("\nYou: ")
    
    if user_input.lower() == 'quit':
        break
    
    try:
        response = llm_with_tools.invoke([HumanMessage(content=user_input)])
        
        # Check if the agent wants to use a tool
        if response.tool_calls:
            print(f"\n[Agent is using tool: {response.tool_calls[0]['name']}]")
            print(f"[Tool args: {response.tool_calls[0]['args']}]")
            
            # Execute the tool directly
            action = response.tool_calls[0]['args']['action']
            tool_result = calculate_care.invoke({"action": action})
            print(f"[Tool result: {tool_result}]")
            
            # Let the agent respond with the tool result
            final_response = llm.invoke([
                HumanMessage(content=user_input),
                response,
                ToolMessage(content=str(tool_result), tool_call_id=response.tool_calls[0]['id'])
            ])
            print(f"\nAgent: {final_response.content}")
        else:
            print(f"\nAgent: {response.content}")
    
    except Exception as e:
        print(f"\nError: {e}")
        print("Try rephrasing or ask about CARE actions directly.")