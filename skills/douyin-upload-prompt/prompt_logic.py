#!/usr/bin/env python3
"""
Douyin Upload Prompt Logic
当用户未填写标题、简介、标签时，提供智能提示和默认值
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

class DouyinPromptSkill:
    def __init__(self):
        self.templates_dir = Path(__file__).parent / "templates"
        self.load_templates()
    
    def load_templates(self):
        """加载标题和标签模板"""
        title_file = self.templates_dir / "title_templates.json"
        hashtag_file = self.templates_dir / "hashtag_suggestions.json"
        
        self.title_templates = []
        self.hashtag_suggestions = []
        
        if title_file.exists():
            with open(title_file, 'r', encoding='utf-8') as f:
                self.title_templates = json.load(f)
        
        if hashtag_file.exists():
            with open(hashtag_file, 'r', encoding='utf-8') as f:
                self.hashtag_suggestions = json.load(f)
    
    def check_user_input(self, title: str, description: str, hashtags: List[str]) -> Dict:
        """检查用户输入是否完整"""
        missing = []
        suggestions = {}
        
        # 检查标题
        if not title or title.strip() == "":
            missing.append("标题")
            suggestions["title"] = self.suggest_title()
        
        # 检查简介
        if not description or description.strip() == "":
            missing.append("简介")
            suggestions["description"] = self.suggest_description()
        
        # 检查标签
        if not hashtags or len(hashtags) == 0:
            missing.append("标签")
            suggestions["hashtags"] = self.suggest_hashtags()
        
        return {
            "missing_fields": missing,
            "has_missing": len(missing) > 0,
            "suggestions": suggestions
        }
    
    def suggest_title(self) -> str:
        """生成标题建议"""
        if self.title_templates:
            import random
            return random.choice(self.title_templates)
        return "精彩视频分享"
    
    def suggest_description(self) -> str:
        """生成简介建议"""
        return "分享美好时刻 #视频 #分享"
    
    def suggest_hashtags(self) -> List[str]:
        """生成标签建议"""
        if self.hashtag_suggestions:
            import random
            return random.sample(self.hashtag_suggestions, min(3, len(self.hashtag_suggestions)))
        return ["视频", "分享", "日常"]
    
    def format_prompt(self, missing_fields: List[str], suggestions: Dict) -> str:
        """格式化提示信息"""
        prompt_lines = []
        
        if missing_fields:
            prompt_lines.append(f"⚠️  检测到未填写字段：{', '.join(missing_fields)}")
            prompt_lines.append("")
            
            if "title" in suggestions:
                prompt_lines.append(f"📝 标题建议：{suggestions['title']}")
            
            if "description" in suggestions:
                prompt_lines.append(f"📄 简介建议：{suggestions['description']}")
            
            if "hashtags" in suggestions:
                prompt_lines.append(f"🏷️  标签建议：{' '.join(['#' + tag for tag in suggestions['hashtags']])}")
            
            prompt_lines.append("")
            prompt_lines.append("请确认使用建议内容，或输入自定义内容：")
        
        return "\n".join(prompt_lines)
    
    def get_default_values(self, user_title: str, user_desc: str, user_tags: List[str], 
                          suggestions: Dict) -> Tuple[str, str, List[str]]:
        """获取最终使用的值（用户输入或建议值）"""
        title = user_title if user_title and user_title.strip() != "" else suggestions.get("title", "")
        description = user_desc if user_desc and user_desc.strip() != "" else suggestions.get("description", "")
        hashtags = user_tags if user_tags and len(user_tags) > 0 else suggestions.get("hashtags", [])
        
        return title, description, hashtags


# 使用示例
if __name__ == "__main__":
    skill = DouyinPromptSkill()
    
    # 测试用户输入为空的情况
    result = skill.check_user_input("", "", [])
    print(skill.format_prompt(result["missing_fields"], result["suggestions"]))
    
    # 获取默认值
    title, desc, tags = skill.get_default_values("", "", [], result["suggestions"])
    print(f"最终值：标题={title}, 简介={desc}, 标签={tags}")